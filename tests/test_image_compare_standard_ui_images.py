import tempfile
import types
from pathlib import Path

import torch

from test_image_compare_png_metadata import load_module


def test_execute_exposes_standard_ui_images_for_comfy_assets():
    with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as output_dir:
        module, _ = load_module(temp_dir, output_dir)
        module.RuYiImageCompare.hidden = types.SimpleNamespace(
            unique_id="node-1",
            prompt={"1": {"class_type": "RuYiImageCompare"}},
            extra_pnginfo={"workflow": {"id": "workflow-A", "nodes": [{"id": 1}]}},
        )
        image_a = torch.full((1, 8, 8, 3), 0.25, dtype=torch.float32)
        image_b = torch.full((1, 8, 8, 3), 0.75, dtype=torch.float32)

        result = module.RuYiImageCompare.execute({"image_1": image_a, "image_2": image_b}, "{}")
        ui = result["ui"]

        assert "images" in ui
        assert ui["images"] == [item["preview"] for item in ui["compare_items"]]
        assert len(ui["images"]) == 2
        assert all(item["type"] == "temp" for item in ui["images"])
        assert all((Path(temp_dir) / item["subfolder"] / item["filename"]).is_file() for item in ui["images"])
