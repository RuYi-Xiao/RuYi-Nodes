import tempfile
import types
from pathlib import Path

import torch

from test_image_compare_png_metadata import load_module


def _hidden(node_id: str, workflow_id: str):
    return types.SimpleNamespace(
        unique_id=node_id,
        prompt={"1": {"class_type": "PreviewImage"}},
        extra_pnginfo={"workflow": {"id": workflow_id, "nodes": [{"id": node_id}]}}
    )


def test_temp_preview_cleanup_is_isolated_per_workflow_id():
    with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as output_dir:
        module, _ = load_module(temp_dir, output_dir)
        image = torch.full((1, 8, 8, 3), 0.5, dtype=torch.float32)

        module.RuYiImageCompare.hidden = _hidden("54", "workflow-A")
        result_a = module.RuYiImageCompare.execute({"image_1": image}, "{}")
        preview_a = result_a["ui"]["compare_items"][0]["preview"]
        preview_a_path = Path(temp_dir) / preview_a["subfolder"] / preview_a["filename"]
        assert preview_a_path.is_file()

        module.RuYiImageCompare.hidden = _hidden("54", "workflow-B")
        result_b = module.RuYiImageCompare.execute({"image_1": image}, "{}")
        preview_b = result_b["ui"]["compare_items"][0]["preview"]
        preview_b_path = Path(temp_dir) / preview_b["subfolder"] / preview_b["filename"]
        assert preview_b_path.is_file()

        assert preview_a_path.is_file(), "running workflow B should not delete workflow A preview"


def test_temp_preview_cleanup_still_replaces_previous_run_in_same_workflow():
    with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as output_dir:
        module, _ = load_module(temp_dir, output_dir)
        image = torch.full((1, 8, 8, 3), 0.5, dtype=torch.float32)

        module.RuYiImageCompare.hidden = _hidden("54", "workflow-A")
        result_first = module.RuYiImageCompare.execute({"image_1": image}, "{}")
        preview_first = result_first["ui"]["compare_items"][0]["preview"]
        preview_first_path = Path(temp_dir) / preview_first["subfolder"] / preview_first["filename"]
        assert preview_first_path.is_file()

        module.RuYiImageCompare.hidden = _hidden("54", "workflow-A")
        result_second = module.RuYiImageCompare.execute({"image_1": image}, "{}")
        preview_second = result_second["ui"]["compare_items"][0]["preview"]
        preview_second_path = Path(temp_dir) / preview_second["subfolder"] / preview_second["filename"]
        assert preview_second_path.is_file()

        assert not preview_first_path.is_file(), "rerunning the same workflow should replace prior temp preview files"
