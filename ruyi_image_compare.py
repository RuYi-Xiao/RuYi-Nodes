from __future__ import annotations

import hashlib
import json
import re
import shutil
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image
from aiohttp import web

import folder_paths
from comfy_api.latest import io
from server import PromptServer


CATEGORY = "RuYi-Nodes/image"
TEMP_SUBFOLDER = "ruyi_image_compare"
OUTPUT_SUBFOLDER = "RuYi-Compare"
THUMB_MAX_SIDE = 256
MAX_INPUTS = 64
MAX_MANIFEST_LENGTH = 30000
DEFAULT_FILENAME_TEMPLATE = "%save_name%"
DEFAULT_SAVE_NAME_TEMPLATE = "%display_name-date:yyyy-MM-dd_HHmmss%"
_IMAGE_KEY_RE = re.compile(r"^image_(\d+)$")
_TEMP_FILES_BY_NODE: dict[str, list[Path]] = {}
_TEMP_FILES_LOCK = threading.Lock()
_SAVE_LOCK = threading.Lock()
_SAFE_NAME_RE = re.compile(r"[\\/:*?\"<>|\r\n\t]+")
_SEQ_RE = re.compile(r"^(\d{4,})_")
_DATE_TOKEN_RE = re.compile(r"%date:([^%]+)%")
_DISPLAY_DATE_TOKEN_RE = re.compile(r"%display_name-date:([^%]+)%")


def _tensor_frames(value: Any) -> list[Image.Image]:
    if not isinstance(value, torch.Tensor):
        return []
    if value.ndim == 3:
        value = value.unsqueeze(0)
    if value.ndim != 4 or value.shape[-1] not in (1, 3, 4):
        return []
    frames: list[Image.Image] = []
    tensor = value.detach().to(device="cpu", dtype=torch.float32)
    for frame in tensor:
        arr = (frame.numpy() * 255.0).clip(0, 255).astype(np.uint8)
        channels = arr.shape[-1]
        image = Image.fromarray(arr[..., 0]).convert("RGB") if channels == 1 else Image.fromarray(arr)
        frames.append(image)
    return frames


def _jpeg_ready(image: Image.Image) -> Image.Image:
    if image.mode == "RGB":
        return image
    if image.mode == "L":
        return image.convert("RGB")
    if "A" in image.getbands():
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (24, 24, 24))
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def _image_content_id(image: Image.Image) -> str:
    digest = hashlib.blake2b(digest_size=8)
    digest.update(f"{image.mode}:{image.width}x{image.height}".encode("utf-8"))
    digest.update(image.tobytes())
    return digest.hexdigest()


def _save_frame_files(image: Image.Image, run_id: str, input_no: int, frame_no: int) -> tuple[dict[str, str], dict[str, str], int]:
    temp_root = Path(folder_paths.get_temp_directory())
    output_dir = temp_root / TEMP_SUBFOLDER
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = f"ruyi_compare_{run_id}_i{input_no}_f{frame_no}"
    preview_name = stem + ".png"
    thumb_name = stem + "_thumb.jpg"
    preview_path = output_dir / preview_name
    thumb_path = output_dir / thumb_name
    image.save(preview_path, format="PNG", optimize=False)
    thumb = _jpeg_ready(image.copy())
    resampling = getattr(Image, "Resampling", Image)
    thumb.thumbnail((THUMB_MAX_SIDE, THUMB_MAX_SIDE), resample=resampling.LANCZOS)
    thumb.save(thumb_path, format="JPEG", quality=84, optimize=False, progressive=False)
    preview = {"filename": preview_name, "subfolder": TEMP_SUBFOLDER, "type": "temp"}
    thumbnail = {"filename": thumb_name, "subfolder": TEMP_SUBFOLDER, "type": "temp"}
    return preview, thumbnail, preview_path.stat().st_size


def _sorted_autogrow_inputs(images: Any) -> list[tuple[int, torch.Tensor]]:
    if not isinstance(images, dict):
        return []
    items: list[tuple[int, torch.Tensor]] = []
    for name, value in images.items():
        match = _IMAGE_KEY_RE.fullmatch(str(name))
        if not match or not isinstance(value, torch.Tensor):
            continue
        items.append((int(match.group(1)), value))
    items.sort(key=lambda pair: pair[0])
    return items


def _node_id(node_cls: type) -> str:
    hidden = getattr(node_cls, "hidden", None)
    value = getattr(hidden, "unique_id", None)
    return str(value) if value is not None else "unknown"


def _replace_temp_files(node_id: str, new_files: list[Path]) -> None:
    with _TEMP_FILES_LOCK:
        old_files = _TEMP_FILES_BY_NODE.get(node_id, [])
        _TEMP_FILES_BY_NODE[node_id] = new_files
    for path in old_files:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def _normalize_name_map(value: Any) -> dict[int, str]:
    names: dict[int, str] = {}
    if not isinstance(value, dict):
        return names
    for raw_key, raw_value in value.items():
        try:
            input_no = int(str(raw_key))
        except Exception:
            continue
        if input_no < 1:
            continue
        name = str(raw_value or "").strip()[:128]
        if name:
            names[input_no] = name
    return names


def _parse_manifest(raw: str | None) -> dict[str, Any]:
    default = {"displayNames": {}, "saveNames": {}, "autoSaveKeys": [], "filenameTemplate": DEFAULT_FILENAME_TEMPLATE}
    if not raw:
        return default
    try:
        text = str(raw)
    except Exception:
        return default
    if len(text) > MAX_MANIFEST_LENGTH:
        text = text[:MAX_MANIFEST_LENGTH]
    try:
        data = json.loads(text)
    except Exception:
        return default
    if not isinstance(data, dict):
        return default
    auto_keys = []
    raw_keys = data.get("autoSaveKeys", [])
    if isinstance(raw_keys, list):
        for key in raw_keys:
            key = str(key)
            if re.fullmatch(r"\d+:\d+", key):
                auto_keys.append(key)
    template = str(data.get("filenameTemplate") or DEFAULT_FILENAME_TEMPLATE)[:256] or DEFAULT_FILENAME_TEMPLATE
    return {
        "displayNames": _normalize_name_map(data.get("displayNames") or data.get("inputNames")),
        "saveNames": _normalize_name_map(data.get("saveNames")),
        "autoSaveKeys": auto_keys,
        "filenameTemplate": template,
    }


def _sanitize_name(value: str) -> str:
    text = _SAFE_NAME_RE.sub("_", str(value or "").strip())
    text = re.sub(r"\s+", " ", text).strip(" ._")
    text = text.replace("…", "_")
    return text[:160] or "image"


def _normalize_output_path(value: str) -> str:
    raw = str(value or "").strip().replace("\\", "/")
    windows_drive = re.match(r"^([A-Za-z]:)(?:/+)(.*)$", raw)
    unc = raw.startswith("//")
    posix_absolute = raw.startswith("/") and not unc

    prefix = ""
    remainder = raw
    if windows_drive:
        prefix = windows_drive.group(1) + "/"
        remainder = windows_drive.group(2)
    elif unc:
        prefix = "//"
        remainder = raw[2:]
    elif posix_absolute:
        prefix = "/"
        remainder = raw[1:]

    parts: list[str] = []
    for part in remainder.split("/"):
        part = part.strip()
        if not part or part in {".", ".."}:
            continue
        safe = _sanitize_name(part)
        if safe:
            parts.append(safe)
    if not parts:
        parts = ["image"]
    if not parts[-1].lower().endswith(".png"):
        parts[-1] += ".png"
    return prefix + "/".join(parts)


def _is_absolute_output_path(value: str) -> bool:
    raw = str(value or "").replace("\\", "/")
    return bool(re.match(r"^[A-Za-z]:/", raw)) or raw.startswith("//") or raw.startswith("/")


def _next_sequence(output_dir: Path) -> int:
    max_seq = 0
    if output_dir.is_dir():
        for path in output_dir.iterdir():
            if not path.is_file():
                continue
            match = _SEQ_RE.match(path.name)
            if not match:
                continue
            try:
                max_seq = max(max_seq, int(match.group(1)))
            except Exception:
                continue
    return max_seq + 1


def _python_strftime_format(fmt: str) -> str:
    mapping = [("yyyy", "%Y"), ("MM", "%m"), ("dd", "%d"), ("HH", "%H"), ("mm", "%M"), ("ss", "%S")]
    result = fmt
    for src, dst in mapping:
        result = result.replace(src, dst)
    return result


def _display_label(input_no: int, frame_no: int, frame_counts: dict[int, int], display_names: dict[int, str]) -> str:
    base = display_names.get(input_no) or f"#{input_no}"
    if frame_counts.get(input_no, 0) > 1:
        return f"{base} · 帧 {frame_no + 1}"
    return base


def _save_label(input_no: int, frame_no: int, frame_counts: dict[int, int], save_names: dict[int, str], display_names: dict[int, str]) -> str:
    base = save_names.get(input_no) or DEFAULT_SAVE_NAME_TEMPLATE
    if frame_counts.get(input_no, 0) > 1:
        return f"{base}_帧{frame_no + 1}"
    return base


def _render_filename(template: str, *, index: int, display_name: str, save_name: str, input_no: int, frame_no: int) -> str:
    temp = str(template or DEFAULT_FILENAME_TEMPLATE)[:256]
    def repl_date(match: re.Match[str]) -> str:
        raw = match.group(1)
        try:
            return datetime.now().strftime(_python_strftime_format(raw))
        except Exception:
            return datetime.now().strftime("%Y%m%d_%H%M%S")
    replacements = {
        "%index%": f"{index:04d}",
        "%display_name%": display_name,
        "%name%": save_name,
        "%save_name%": save_name,
        "%input%": str(input_no),
        "%frame%": str(frame_no + 1),
    }
    for _ in range(3):
        before = temp
        for key, value in replacements.items():
            temp = temp.replace(key, value)
        temp = _DISPLAY_DATE_TOKEN_RE.sub(lambda m: f"{display_name}-{repl_date(m)}", temp)
        temp = _DATE_TOKEN_RE.sub(repl_date, temp)
        if temp == before:
            break
    return _normalize_output_path(temp)


def _copy_to_output(preview_path: Path, filename: str, *, source: str) -> dict[str, str]:
    output_root = Path(folder_paths.get_output_directory())
    output_dir = output_root / OUTPUT_SUBFOLDER
    output_dir.mkdir(parents=True, exist_ok=True)

    normalized = str(filename).replace("\\", "/")
    is_absolute = _is_absolute_output_path(normalized)
    if is_absolute:
        if re.match(r"^[A-Za-z]:/", normalized) and Path().anchor == "":
            # A Windows drive path is meaningful on the user's Windows ComfyUI host.
            # On non-Windows test hosts, keep it classified as absolute but do not
            # silently reinterpret it as a relative RuYi-Compare subfolder.
            import os
            if os.name != "nt":
                raise ValueError(f"Windows absolute save path is unavailable on this platform: {normalized}")
        target = Path(normalized)
        dst_dir = target.parent
        base = target.stem
        suffix = target.suffix or ".png"
        subfolder = ""
    else:
        rel_path = Path(normalized)
        dst_dir = output_dir / rel_path.parent if str(rel_path.parent) != "." else output_dir
        base = rel_path.stem
        suffix = rel_path.suffix or ".png"
        rel_subfolder = Path(OUTPUT_SUBFOLDER) / rel_path.parent if str(rel_path.parent) != "." else Path(OUTPUT_SUBFOLDER)
        subfolder = rel_subfolder.as_posix()

    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / f"{base}{suffix}"
    counter = 2
    while dst.exists():
        dst = dst_dir / f"{base}_{counter}{suffix}"
        counter += 1
    shutil.copy2(preview_path, dst)
    print(f"[RuYi Image Compare] {source} saved: {dst}")
    return {"filename": dst.name, "subfolder": subfolder, "type": "output", "full_path": str(dst)}


def _resolve_temp_preview_path(info: Any) -> Path | None:
    if not isinstance(info, dict):
        return None
    filename = str(info.get("filename") or "")
    subfolder = str(info.get("subfolder") or "")
    kind = str(info.get("type") or "")
    if not filename or kind != "temp":
        return None
    temp_root = Path(folder_paths.get_temp_directory()).resolve()
    path = (temp_root / subfolder / filename).resolve()
    try:
        path.relative_to(temp_root)
    except Exception:
        return None
    return path if path.is_file() else None


def _autosave_compare_items(compare_items: list[dict[str, Any]], manifest: dict[str, Any]) -> list[dict[str, Any]]:
    auto_keys = set(manifest.get("autoSaveKeys", []))
    if not auto_keys:
        return []
    display_names = manifest.get("displayNames", {}) or {}
    save_names = manifest.get("saveNames", {}) or {}
    template = manifest.get("filenameTemplate") or DEFAULT_FILENAME_TEMPLATE
    frame_counts: dict[int, int] = {}
    for item in compare_items:
        frame_counts[item["input"]] = frame_counts.get(item["input"], 0) + 1
    saved: list[dict[str, Any]] = []
    output_root = Path(folder_paths.get_output_directory()) / OUTPUT_SUBFOLDER
    with _SAVE_LOCK:
        next_index = _next_sequence(output_root)
        for item in compare_items:
            if item["key"] not in auto_keys:
                continue
            preview_path = _resolve_temp_preview_path(item.get("preview"))
            if not preview_path:
                continue
            display_label = _display_label(item["input"], item["frame"], frame_counts, display_names)
            save_label = _save_label(item["input"], item["frame"], frame_counts, save_names, display_names)
            filename = _render_filename(template, index=next_index, display_name=display_label, save_name=save_label, input_no=item["input"], frame_no=item["frame"])
            out = _copy_to_output(preview_path, filename, source="Auto")
            saved.append({"key": item["key"], **out})
            next_index += 1
    return saved


class RuYiImageCompare(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        template = io.Autogrow.TemplateNames(io.Image.Input("image"), names=[f"image_{i}" for i in range(1, MAX_INPUTS + 1)], min=1)
        return io.Schema(
            node_id="RuYiImageCompare",
            display_name="RuYi image-compare",
            category=CATEGORY,
            description="Compare any two images from a dynamically growing set of IMAGE inputs.",
            inputs=[io.Autogrow.Input("images", template=template), io.String.Input("save_manifest", default="{}")],
            outputs=[],
            hidden=[io.Hidden.unique_id],
            is_output_node=True,
        )

    @classmethod
    def execute(cls, images: io.Autogrow.Type, save_manifest: str = "{}") -> io.NodeOutput:
        run_id = uuid.uuid4().hex[:12]
        compare_items: list[dict[str, Any]] = []
        new_files: list[Path] = []
        temp_root = Path(folder_paths.get_temp_directory())
        try:
            for input_no, tensor in _sorted_autogrow_inputs(images):
                frames = _tensor_frames(tensor)
                frame_count = len(frames)
                for frame_no, image in enumerate(frames):
                    preview, thumb, size_bytes = _save_frame_files(image, run_id, input_no, frame_no)
                    new_files.extend([temp_root / preview["subfolder"] / preview["filename"], temp_root / thumb["subfolder"] / thumb["filename"]])
                    compare_items.append({
                        "key": f"{input_no}:{frame_no}",
                        "input": input_no,
                        "frame": frame_no,
                        "frame_count": frame_count,
                        "width": int(image.width),
                        "height": int(image.height),
                        "size_bytes": int(size_bytes),
                        "content_id": _image_content_id(image),
                        "preview": preview,
                        "thumb": thumb,
                    })
        except Exception:
            for path in new_files:
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass
            raise
        _replace_temp_files(_node_id(cls), new_files)
        manifest = _parse_manifest(save_manifest)
        autosaved = _autosave_compare_items(compare_items, manifest)
        return io.NodeOutput(ui={"compare_items": compare_items, "autosaved": autosaved})


@PromptServer.instance.routes.post("/ruyi_nodes/image_compare/manual_save")
async def ruyi_image_compare_manual_save(request):
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"error": "invalid-json"}, status=400)
    path = _resolve_temp_preview_path(payload.get("preview"))
    if not path:
        return web.json_response({"error": "preview-not-found"}, status=404)
    input_no = int(payload.get("input_no") or 1)
    frame_no = int(payload.get("frame_no") or 0)
    frame_count = max(1, int(payload.get("frame_count") or 1))
    display_name = str(payload.get("display_name") or f"#{input_no}")
    save_name = str(payload.get("save_name") or DEFAULT_SAVE_NAME_TEMPLATE)
    template = str(payload.get("filename_template") or DEFAULT_FILENAME_TEMPLATE)
    frame_counts = {input_no: frame_count}
    display_label = _display_label(input_no, frame_no, frame_counts, {input_no: display_name})
    save_label = _save_label(input_no, frame_no, frame_counts, {input_no: save_name}, {input_no: display_name})
    output_root = Path(folder_paths.get_output_directory()) / OUTPUT_SUBFOLDER
    try:
        with _SAVE_LOCK:
            next_index = _next_sequence(output_root)
            filename = _render_filename(template, index=next_index, display_name=display_label, save_name=save_label, input_no=input_no, frame_no=frame_no)
            out = _copy_to_output(path, filename, source="Manual")
        return web.json_response({"ok": True, **out})
    except Exception as exc:
        return web.json_response({"error": str(exc)}, status=500)


NODE_CLASS_MAPPINGS = {"RuYiImageCompare": RuYiImageCompare}
NODE_DISPLAY_NAME_MAPPINGS = {"RuYiImageCompare": "RuYi image-compare"}
