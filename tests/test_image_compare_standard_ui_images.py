import json
import tempfile
import types
from pathlib import Path

import torch

from test_image_compare_png_metadata import load_module


def _temp_path(temp_dir: str, info: dict[str, str]) -> Path:
    return Path(temp_dir) / info["subfolder"] / info["filename"]


def _comfy_merge_ui(uis: list[dict]) -> dict:
    # Mirrors ComfyUI execution.py: all UI fields are flattened as iterables.
    return {key: [item for ui in uis for item in ui[key]] for key in uis[0].keys()}


def _comfy_jobs_outputs_count(ui: dict) -> int:
    # Mirrors the relevant jobs.py behavior: dict file/media entries count as
    # outputs, while opaque non-media strings under a custom key are metadata.
    count = 0
    for media_type, items in ui.items():
        if media_type == "animated" or not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict):
                count += 1
    return count


def test_execute_separates_compare_previews_from_comfy_media_assets():
    with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as output_dir:
        module, _ = load_module(temp_dir, output_dir)
        module.RuYiImageCompare.hidden = types.SimpleNamespace(
            unique_id="node-1",
            prompt={"1": {"class_type": "RuYiImageCompare"}},
            extra_pnginfo={"workflow": {"id": "workflow-A", "nodes": [{"id": 1}]}},
        )
        image_a = torch.full((1, 8, 8, 3), 0.25, dtype=torch.float32)
        image_b = torch.full((1, 8, 8, 3), 0.75, dtype=torch.float32)

        first = module.RuYiImageCompare.execute({"image_1": image_a, "image_2": image_b}, "{}")
        first_raw_ui = first["ui"]
        first_ui = _comfy_merge_ui([first_raw_ui])
        assert isinstance(first_ui["ruyi_data"], list)
        assert len(first_ui["ruyi_data"]) == 1
        payload = json.loads(first_ui["ruyi_data"][0])
        first_previews = [item["preview"] for item in payload["compare_items"]]
        first_assets = first_ui["images"]

        assert len(first_assets) == 2
        assert _comfy_jobs_outputs_count(first_ui) == len(first_assets)
        assert first_assets != first_previews
        assert all(item["type"] == "temp" for item in first_assets)
        assert all(item["subfolder"] == module.MEDIA_ASSET_SUBFOLDER for item in first_assets)

        first_preview_paths = [_temp_path(temp_dir, item) for item in first_previews]
        first_asset_paths = [_temp_path(temp_dir, item) for item in first_assets]
        assert all(path.is_file() for path in first_preview_paths)
        assert all(path.is_file() for path in first_asset_paths)

        second = module.RuYiImageCompare.execute({"image_1": image_a, "image_2": image_b}, "{}")
        second_ui = _comfy_merge_ui([second["ui"]])

        assert all(not path.exists() for path in first_preview_paths)
        assert all(path.is_file() for path in first_asset_paths)
        assert all(_temp_path(temp_dir, item).is_file() for item in second_ui["images"])
