import importlib.util
import json
import sys
import tempfile
import types
from pathlib import Path

import torch
from PIL import Image

MODULE_PATH = Path(__file__).resolve().parents[1] / "ruyi_image_compare.py"


def _ruyi_payload(result):
    raw = result["ui"]["ruyi_data"]
    assert isinstance(raw, list) and raw
    return json.loads(raw[0])


def load_module(tmp_dir: str, output_dir: str):
    folder_paths = types.ModuleType("folder_paths")
    folder_paths.get_temp_directory = lambda: tmp_dir
    folder_paths.get_output_directory = lambda: output_dir
    sys.modules["folder_paths"] = folder_paths

    class DummyAutogrow:
        class Type(dict):
            pass

        class TemplateNames:
            def __init__(self, *args, **kwargs):
                pass

        class Input:
            def __init__(self, *args, **kwargs):
                pass

    class DummyImage:
        @staticmethod
        def Input(*args, **kwargs):
            return ("IMAGE", args, kwargs)

    class DummyString:
        @staticmethod
        def Input(*args, **kwargs):
            return ("STRING", args, kwargs)

    class DummySchema:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

    class DummyNodeOutput(dict):
        def __init__(self, **kwargs):
            super().__init__(**kwargs)

    class DummyHidden:
        unique_id = "uid"
        prompt = "prompt"
        extra_pnginfo = "extra_pnginfo"

    class DummyComfyNode:
        pass

    io = types.SimpleNamespace(
        Autogrow=DummyAutogrow,
        Image=DummyImage,
        String=DummyString,
        Schema=DummySchema,
        NodeOutput=DummyNodeOutput,
        Hidden=DummyHidden,
        ComfyNode=DummyComfyNode,
    )
    latest = types.ModuleType("comfy_api.latest")
    latest.io = io
    pkg = types.ModuleType("comfy_api")
    pkg.latest = latest
    sys.modules["comfy_api"] = pkg
    sys.modules["comfy_api.latest"] = latest

    cli_args = types.ModuleType("comfy.cli_args")
    cli_args.args = types.SimpleNamespace(disable_metadata=False)
    comfy_pkg = types.ModuleType("comfy")
    comfy_pkg.cli_args = cli_args
    sys.modules["comfy"] = comfy_pkg
    sys.modules["comfy.cli_args"] = cli_args

    class Routes:
        def post(self, path):
            def decorator(fn):
                return fn
            return decorator

    class PromptServer:
        instance = types.SimpleNamespace(routes=Routes())

    server = types.ModuleType("server")
    server.PromptServer = PromptServer
    sys.modules["server"] = server

    spec = importlib.util.spec_from_file_location("ruyi_image_compare_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, cli_args.args


def test_preview_png_contains_comfy_prompt_and_workflow_metadata():
    with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as output_dir:
        module, _ = load_module(temp_dir, output_dir)
        module.RuYiImageCompare.hidden = types.SimpleNamespace(
            unique_id="node-1",
            prompt={"10": {"class_type": "KSampler", "inputs": {"seed": 123}}},
            extra_pnginfo={"workflow": {"nodes": [{"id": 10, "type": "KSampler"}]}, "extra": {"x": 1}},
        )
        image = torch.full((1, 8, 8, 3), 0.5, dtype=torch.float32)

        manifest = json.dumps({"autoSaveKeys": ["1:0"], "displayNames": {"1": "sample"}})
        result = module.RuYiImageCompare.execute({"image_1": image}, manifest)
        preview = _ruyi_payload(result)["compare_items"][0]["preview"]
        preview_path = Path(temp_dir) / preview["subfolder"] / preview["filename"]

        with Image.open(preview_path) as saved:
            assert json.loads(saved.info["prompt"])["10"]["inputs"]["seed"] == 123
            assert json.loads(saved.info["workflow"])["nodes"][0]["id"] == 10
            assert json.loads(saved.info["extra"])["x"] == 1

        saved_path = Path(_ruyi_payload(result)["autosaved"][0]["full_path"])
        with Image.open(saved_path) as saved_output:
            assert json.loads(saved_output.info["prompt"])["10"]["inputs"]["seed"] == 123
            assert json.loads(saved_output.info["workflow"])["nodes"][0]["id"] == 10


def test_disable_metadata_keeps_preview_png_clean():
    with tempfile.TemporaryDirectory() as temp_dir, tempfile.TemporaryDirectory() as output_dir:
        module, args = load_module(temp_dir, output_dir)
        args.disable_metadata = True
        module.RuYiImageCompare.hidden = types.SimpleNamespace(
            unique_id="node-1",
            prompt={"1": {"class_type": "KSampler"}},
            extra_pnginfo={"workflow": {"nodes": [{"id": 1}]}},
        )
        image = torch.full((1, 8, 8, 3), 0.5, dtype=torch.float32)

        result = module.RuYiImageCompare.execute({"image_1": image}, "{}")
        preview = _ruyi_payload(result)["compare_items"][0]["preview"]
        preview_path = Path(temp_dir) / preview["subfolder"] / preview["filename"]

        with Image.open(preview_path) as saved:
            assert "prompt" not in saved.info
            assert "workflow" not in saved.info
