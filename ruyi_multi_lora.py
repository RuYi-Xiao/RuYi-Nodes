from __future__ import annotations

import asyncio
import json
import mimetypes
import os
from collections import OrderedDict
from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import Any

from PIL import Image, ImageOps

from aiohttp import web
import folder_paths
from server import PromptServer
import nodes


VERSION = "0.1.18"
CATEGORY = "RuYi-Nodes/loaders"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"}

# Preview thumbnails are generated in memory only. No thumbnail files are
# written next to LoRAs or into a cache directory. The bounded LRU holds JPEG
# bytes for the current ComfyUI process and is discarded on restart.
_PREVIEW_MEMORY_CACHE_MAX = 256
_preview_memory_cache: OrderedDict[tuple[Any, ...], bytes] = OrderedDict()
_preview_cache_lock = Lock()


def _clamp_int(value: Any, default: int, low: int, high: int) -> int:
    try:
        value = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, value))


def _thumbnail_jpeg_bytes(path: str, width: int, height: int, quality: int) -> bytes:
    """Decode one preview and return a small 4:5-style JPEG entirely in memory.

    The source file is still decoded on the first request, but transfer size and
    browser decode cost become tiny. Subsequent requests during this ComfyUI
    session are served from the bounded RAM cache.
    """
    mtime_ns = os.stat(path).st_mtime_ns
    key = (os.path.normcase(os.path.abspath(path)), mtime_ns, width, height, quality)
    with _preview_cache_lock:
        cached = _preview_memory_cache.get(key)
        if cached is not None:
            _preview_memory_cache.move_to_end(key)
            return cached

    with Image.open(path) as image:
        # Animated previews only need the first frame for a static node thumbnail.
        try:
            image.seek(0)
        except Exception:
            pass
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "L"):
            # Composite transparent images over the same neutral background used
            # by the node instead of silently turning transparency black.
            if "A" in image.getbands():
                rgba = image.convert("RGBA")
                bg = Image.new("RGB", rgba.size, (34, 34, 34))
                bg.paste(rgba, mask=rgba.getchannel("A"))
                image = bg
            else:
                image = image.convert("RGB")
        elif image.mode == "L":
            image = image.convert("RGB")

        # Exact crop keeps all RuYi preview widgets visually stable regardless of
        # the Civitai/source image aspect ratio. LANCZOS gives good quality even
        # at the deliberately small output sizes used by the UI.
        thumb = ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        out = BytesIO()
        thumb.save(out, format="JPEG", quality=quality, optimize=False, progressive=False, subsampling=2)
        data = out.getvalue()

    with _preview_cache_lock:
        _preview_memory_cache[key] = data
        _preview_memory_cache.move_to_end(key)
        while len(_preview_memory_cache) > _PREVIEW_MEMORY_CACHE_MAX:
            _preview_memory_cache.popitem(last=False)
    return data


def _lora_path(lora_name: str) -> str | None:
    if not lora_name:
        return None
    try:
        if hasattr(folder_paths, "get_full_path"):
            path = folder_paths.get_full_path("loras", lora_name)
            if path:
                return os.path.abspath(path)
    except Exception:
        pass
    try:
        return os.path.abspath(folder_paths.get_full_path_or_raise("loras", lora_name))
    except Exception:
        return None


def _sidecar_path(lora_path: str) -> str:
    # LoRA Manager documented naming:
    # my_lora.safetensors -> my_lora.metadata.json
    return os.path.splitext(lora_path)[0] + ".metadata.json"


def _read_json(path: str) -> dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _parse_usage_tips(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _trigger_words(metadata: dict[str, Any]) -> list[str]:
    civitai = metadata.get("civitai")
    if not isinstance(civitai, dict):
        return []
    words = civitai.get("trainedWords")
    if not isinstance(words, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for word in words:
        if not isinstance(word, str):
            continue
        word = word.strip()
        key = word.casefold()
        if word and key not in seen:
            seen.add(key)
            out.append(word)
    return out


def _source_url(metadata: dict[str, Any]) -> str:
    """Return a safe public model page URL from LoRA Manager metadata.

    LoRA Manager preserves the Civitai version payload in ``civitai``.  The
    documented ``modelId`` + version ``id`` pair is enough to reconstruct the
    public release page without depending on LoRA Manager internals.
    """
    def safe_http(value: Any) -> str:
        if not isinstance(value, str):
            return ""
        value = value.strip()
        return value if value.lower().startswith(("https://", "http://")) else ""

    # Be forward-compatible with explicit URL fields should LoRA Manager or a
    # user-created sidecar provide one.
    for key in ("source_url", "model_url", "url"):
        url = safe_http(metadata.get(key))
        if url:
            return url

    civitai = metadata.get("civitai")
    if not isinstance(civitai, dict):
        return ""

    for key in ("modelUrl", "model_url", "url"):
        url = safe_http(civitai.get(key))
        if url:
            return url

    model_id = civitai.get("modelId")
    version_id = civitai.get("id")
    try:
        model_id = int(model_id)
    except (TypeError, ValueError):
        return ""

    version_query = ""
    try:
        version_id = int(version_id)
        version_query = f"?modelVersionId={version_id}"
    except (TypeError, ValueError):
        pass

    # CivArchive uses the same Civitai IDs. Prefer it when LoRA Manager says
    # the metadata came from an archive or that the original Civitai item is
    # deleted; otherwise open the normal Civitai release page.
    source = str(metadata.get("metadata_source") or "").lower()
    if source in {"civarchive", "archive_db"} or bool(metadata.get("civitai_deleted")):
        return f"https://civarchive.com/models/{model_id}{version_query}"
    return f"https://civitai.com/models/{model_id}{version_query}"


def _is_safe_preview(path: str, lora_path: str) -> bool:
    try:
        p = Path(path).resolve()
        if not p.is_file() or p.suffix.lower() not in IMAGE_EXTENSIONS:
            return False

        # Restrict previews to configured LoRA roots. This supports normal folders,
        # junctions and symlinks while preventing arbitrary file serving.
        for root in folder_paths.get_folder_paths("loras"):
            try:
                root_p = Path(root).resolve()
                p.relative_to(root_p)
                return True
            except Exception:
                continue

        # Fallback: allow a preview next to the selected LoRA file.
        try:
            p.relative_to(Path(lora_path).resolve().parent)
            return True
        except Exception:
            return False
    except Exception:
        return False


def _resolve_preview(metadata: dict[str, Any], lora_path: str) -> str | None:
    candidates: list[str] = []
    raw = metadata.get("preview_url")
    if isinstance(raw, str) and raw.strip() and not raw.lower().startswith(("http://", "https://")):
        raw = os.path.expandvars(os.path.expanduser(raw.strip()))
        if os.path.isabs(raw):
            candidates.append(raw)
        else:
            candidates.append(os.path.join(os.path.dirname(lora_path), raw))

    stem = os.path.splitext(lora_path)[0]
    for ext in (".webp", ".png", ".jpg", ".jpeg", ".gif", ".avif"):
        candidates.append(stem + ext)
        candidates.append(stem + ".preview" + ext)

    for candidate in candidates:
        candidate = os.path.abspath(candidate)
        if _is_safe_preview(candidate, lora_path):
            return candidate
    return None


def _relative_folder(lora_name: str) -> str:
    """Return the LoRA's relative parent folder as stored by ComfyUI."""
    normalized = str(lora_name or "").replace("/", "\\")
    if "\\" not in normalized:
        return ""
    return normalized.rsplit("\\", 1)[0]


def _metadata_for_lora(lora_name: str) -> dict[str, Any]:
    path = _lora_path(lora_name)
    if not path:
        return {
            "lora": lora_name,
            "exists": False,
            "metadata_exists": False,
            "trigger_words": [],
            "usage_tips": {},
            "notes": "",
            "folder": _relative_folder(lora_name),
            "preview_available": False,
            "source_url": "",
        }

    sidecar = _sidecar_path(path)
    metadata = _read_json(sidecar) if os.path.isfile(sidecar) else {}
    preview = _resolve_preview(metadata, path)
    usage = _parse_usage_tips(metadata.get("usage_tips"))
    triggers = _trigger_words(metadata)

    return {
        "lora": lora_name,
        "exists": True,
        "metadata_exists": os.path.isfile(sidecar),
        "model_name": metadata.get("model_name") or Path(path).stem,
        "base_model": metadata.get("base_model") or "",
        "tags": metadata.get("tags") if isinstance(metadata.get("tags"), list) else [],
        "notes": metadata.get("notes") if isinstance(metadata.get("notes"), str) else "",
        "folder": _relative_folder(lora_name),
        "trigger_words": triggers,
        "usage_tips": usage,
        "metadata_source": metadata.get("metadata_source"),
        "source_url": _source_url(metadata),
        "preview_available": bool(preview),
        "metadata_mtime": os.path.getmtime(sidecar) if os.path.isfile(sidecar) else 0,
        "preview_mtime": os.path.getmtime(preview) if preview else 0,
    }


def _trigger_words_for_lora(lora_name: str) -> list[str]:
    """Read only the metadata needed for trigger-word output.

    Workflow execution does not need preview discovery, usage tips, notes, or
    source URLs. Keeping this path lightweight avoids repeated preview-file
    stat/resolve work every time a prompt executes.
    """
    path = _lora_path(lora_name)
    if not path:
        return []
    sidecar = _sidecar_path(path)
    if not os.path.isfile(sidecar):
        return []
    return _trigger_words(_read_json(sidecar))


def _trigger_metadata_fingerprint(stack_config: Any) -> str:
    """Return a stable fingerprint for external trigger metadata dependencies.

    ComfyUI normally invalidates a node when its explicit inputs change. Trigger
    words also depend on LoRA Manager sidecars, which may be edited externally
    while the workflow inputs remain identical. The sidecar mtime/size signature
    lets ComfyUI re-run only when relevant trigger metadata actually changes.
    """
    try:
        stack = _parse_stack(stack_config)
    except Exception:
        return "invalid-stack"

    parts: list[str] = []
    seen: set[str] = set()
    for item in stack:
        if not _enabled(item) or not bool(item.get("include_trigger", True)):
            continue
        lora_name = _name(item)
        if not lora_name or lora_name in seen:
            continue
        seen.add(lora_name)
        path = _lora_path(lora_name)
        if not path:
            parts.append(f"{lora_name}|missing-lora")
            continue
        sidecar = _sidecar_path(path)
        try:
            stat = os.stat(sidecar)
            parts.append(f"{lora_name}|{stat.st_mtime_ns}|{stat.st_size}")
        except OSError:
            parts.append(f"{lora_name}|missing-metadata")
    return "\n".join(parts)


def _prune_loader_cache(loaders: dict[str, Any], active_names: set[str]) -> None:
    """Release cached LoRA tensors that are no longer active in this node.

    Core ComfyUI LoraLoader instances keep the loaded LoRA state dict in memory.
    RuYi uses one loader per active LoRA so a current stack stays cached across
    executions, but historical selections should not remain resident forever.
    """
    for name in tuple(loaders):
        if name not in active_names:
            loaders.pop(name, None)


def _parse_stack(stack_config: Any) -> list[dict[str, Any]]:
    if isinstance(stack_config, list):
        raw = stack_config
    elif isinstance(stack_config, str):
        try:
            raw = json.loads(stack_config or "[]")
        except json.JSONDecodeError as exc:
            raise ValueError(f"RuYi multi-LoRA: invalid stack_config JSON: {exc}") from exc
    else:
        raw = []
    if not isinstance(raw, list):
        raise ValueError("RuYi multi-LoRA: stack_config must be a JSON list")
    return [item for item in raw if isinstance(item, dict)]


def _enabled(item: dict[str, Any]) -> bool:
    return bool(item.get("enabled", item.get("on", True)))


def _name(item: dict[str, Any]) -> str:
    return str(item.get("lora", item.get("lora_name", "")) or "").strip()


def _strength(item: dict[str, Any], key: str, fallback: float = 1.0) -> float:
    try:
        return float(item.get(key, fallback))
    except (TypeError, ValueError):
        return fallback


def _collect_triggers(stack: list[dict[str, Any]]) -> str:
    out: list[str] = []
    seen_words: set[str] = set()
    per_lora: dict[str, list[str]] = {}
    for item in stack:
        if not _enabled(item) or not bool(item.get("include_trigger", True)):
            continue
        lora_name = _name(item)
        if not lora_name:
            continue
        words = per_lora.get(lora_name)
        if words is None:
            words = _trigger_words_for_lora(lora_name)
            per_lora[lora_name] = words
        for word in words:
            key = word.casefold()
            if key not in seen_words:
                seen_words.add(key)
                out.append(word)
    return ", ".join(out)


def _catalog_details(names: list[str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for name in names:
        meta = _metadata_for_lora(name)
        base_model = meta.get("base_model") or ""
        items.append({
            "lora": name,
            "model_name": meta.get("model_name") or Path(name).stem,
            "base_model": base_model,
            "model_type": base_model or "Unknown",
            "folder": meta.get("folder") or _relative_folder(name),
            "metadata_exists": bool(meta.get("metadata_exists")),
            "preview_available": bool(meta.get("preview_available")),
            "preview_mtime": meta.get("preview_mtime", 0),
        })
    return items


@PromptServer.instance.routes.get("/ruyi_nodes/loras")
async def ruyi_lora_list(request):
    try:
        names = sorted(folder_paths.get_filename_list("loras"), key=lambda s: s.casefold())
        response: dict[str, Any] = {"version": VERSION, "loras": names}
        if request.query.get("details", "").lower() in {"1", "true", "yes"}:
            # Large LoRA libraries may require thousands of small filesystem
            # checks/sidecar reads. Run the scan in a worker thread so the
            # ComfyUI aiohttp event loop remains responsive.
            items = await asyncio.to_thread(_catalog_details, names)
            # Friendly model names are the primary visible label in the selector.
            # The original LoRA path remains the stable value stored in workflows.
            response["items"] = items
        return web.json_response(response)
    except Exception as exc:
        return web.json_response({"error": str(exc), "loras": [], "items": []}, status=500)


@PromptServer.instance.routes.get("/ruyi_nodes/lora_metadata")
async def ruyi_lora_metadata(request):
    name = request.query.get("name", "")
    metadata = await asyncio.to_thread(_metadata_for_lora, name)
    return web.json_response(metadata)


@PromptServer.instance.routes.get("/ruyi_nodes/lora_preview")
async def ruyi_lora_preview(request):
    name = request.query.get("name", "")
    lora_path = _lora_path(name)
    if not lora_path:
        raise web.HTTPNotFound()
    metadata_path = _sidecar_path(lora_path)
    metadata = _read_json(metadata_path) if os.path.isfile(metadata_path) else {}
    preview = _resolve_preview(metadata, lora_path)
    if not preview:
        raise web.HTTPNotFound()

    # If size parameters are present, return an in-memory low-resolution JPEG.
    # This deliberately avoids creating any thumbnail files on disk. PIL decode
    # runs in a worker thread so quick scrolling does not block ComfyUI's aiohttp
    # event loop while a large original preview is being decoded/resized.
    if "w" in request.query or "h" in request.query:
        width = _clamp_int(request.query.get("w"), 128, 32, 512)
        height = _clamp_int(request.query.get("h"), 160, 32, 640)
        quality = _clamp_int(request.query.get("q"), 70, 35, 90)
        try:
            data = await asyncio.to_thread(_thumbnail_jpeg_bytes, preview, width, height, quality)
            return web.Response(
                body=data,
                content_type="image/jpeg",
                headers={
                    # Browser-level disk caching is intentionally disabled. The
                    # RuYi process keeps only a bounded RAM cache.
                    "Cache-Control": "no-store",
                    "X-RuYi-Preview": f"memory-thumbnail-{width}x{height}-q{quality}",
                },
            )
        except Exception as exc:
            print(f"[RuYi-Nodes] thumbnail generation failed for {preview}: {exc}")

    mime, _ = mimetypes.guess_type(preview)
    return web.FileResponse(preview, headers={"Content-Type": mime or "application/octet-stream"})


class RuYiMultiLoraLoader:
    """Multi-LoRA loader for MODEL + CLIP with LoRA Manager metadata integration."""

    def __init__(self):
        # One core loader per LoRA preserves ComfyUI's normal loaded-LoRA cache
        # across executions, similar to a chain of individual LoraLoader nodes.
        self._loaders: dict[str, nodes.LoraLoader] = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "stack_config": ("RUYI_LORA_STACK", {"default": "[]"}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "trigger_words")
    FUNCTION = "load_loras"
    CATEGORY = CATEGORY
    DESCRIPTION = (
        "Loads multiple LoRAs with independent MODEL/CLIP strengths. "
        "The optional preview/trigger-word UI reads ComfyUI-Lora-Manager .metadata.json sidecars."
    )

    @classmethod
    def IS_CHANGED(cls, stack_config="[]", **kwargs):
        return _trigger_metadata_fingerprint(stack_config)

    def load_loras(self, model, clip, stack_config="[]"):
        stack = _parse_stack(stack_config)
        active_names: set[str] = set()
        for item in stack:
            if not _enabled(item):
                continue
            lora_name = _name(item)
            if not lora_name:
                continue
            sm = _strength(item, "strength_model", _strength(item, "strength", 1.0))
            sc = _strength(item, "strength_clip", sm)
            if sm != 0 or sc != 0:
                active_names.add(lora_name)
        _prune_loader_cache(self._loaders, active_names)

        current_model, current_clip = model, clip
        for item in stack:
            if not _enabled(item):
                continue
            lora_name = _name(item)
            if not lora_name:
                continue
            if _lora_path(lora_name) is None:
                raise FileNotFoundError(f"RuYi multi-Lora-loader: LoRA not found: {lora_name}")
            sm = _strength(item, "strength_model", _strength(item, "strength", 1.0))
            sc = _strength(item, "strength_clip", sm)
            if sm == 0 and sc == 0:
                continue
            loader = self._loaders.setdefault(lora_name, nodes.LoraLoader())
            current_model, current_clip = loader.load_lora(
                current_model, current_clip, lora_name, sm, sc
            )
        return current_model, current_clip, _collect_triggers(stack)


class RuYiMultiLoraLoaderModelOnly:
    """Multi-LoRA loader for MODEL only with LoRA Manager metadata integration."""

    def __init__(self):
        self._loaders: dict[str, nodes.LoraLoaderModelOnly] = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "stack_config": ("RUYI_LORA_STACK", {"default": "[]"}),
            }
        }

    RETURN_TYPES = ("MODEL", "STRING")
    RETURN_NAMES = ("MODEL", "trigger_words")
    FUNCTION = "load_loras"
    CATEGORY = CATEGORY
    DESCRIPTION = (
        "Loads multiple LoRAs into MODEL only. "
        "The optional preview/trigger-word UI reads ComfyUI-Lora-Manager .metadata.json sidecars."
    )

    @classmethod
    def IS_CHANGED(cls, stack_config="[]", **kwargs):
        return _trigger_metadata_fingerprint(stack_config)

    def load_loras(self, model, stack_config="[]"):
        stack = _parse_stack(stack_config)
        active_names: set[str] = set()
        for item in stack:
            if not _enabled(item):
                continue
            lora_name = _name(item)
            if not lora_name:
                continue
            sm = _strength(item, "strength_model", _strength(item, "strength", 1.0))
            if sm != 0:
                active_names.add(lora_name)
        _prune_loader_cache(self._loaders, active_names)

        current_model = model
        for item in stack:
            if not _enabled(item):
                continue
            lora_name = _name(item)
            if not lora_name:
                continue
            if _lora_path(lora_name) is None:
                raise FileNotFoundError(f"RuYi multi-Lora-loader (model only): LoRA not found: {lora_name}")
            sm = _strength(item, "strength_model", _strength(item, "strength", 1.0))
            if sm == 0:
                continue
            loader = self._loaders.setdefault(lora_name, nodes.LoraLoaderModelOnly())
            current_model, = loader.load_lora_model_only(current_model, lora_name, sm)
        return current_model, _collect_triggers(stack)


class RuYiTextPreview:
    """Simple STRING monitor/output node for inspecting final merged prompt text."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("STRING",)
    FUNCTION = "preview"
    CATEGORY = "RuYi-Nodes/text"
    OUTPUT_NODE = True
    DESCRIPTION = (
        "Displays the input STRING after execution and passes it through unchanged. "
        "Useful for inspecting merged prompt / LoRA trigger text."
    )

    def preview(self, text=""):
        text = "" if text is None else str(text)
        return {
            "ui": {"text": [text]},
            "result": (text,),
        }


NODE_CLASS_MAPPINGS = {
    "RuYiMultiLoraLoader": RuYiMultiLoraLoader,
    "RuYiMultiLoraLoaderModelOnly": RuYiMultiLoraLoaderModelOnly,
    "RuYiTextPreview": RuYiTextPreview,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RuYiMultiLoraLoader": "RuYi multi-Lora-loader",
    "RuYiMultiLoraLoaderModelOnly": "RuYi multi-Lora-loader (model only)",
    "RuYiTextPreview": "RuYi text-preview",
}
