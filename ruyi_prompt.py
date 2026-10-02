from __future__ import annotations

import json
from pathlib import Path


DEFAULT_PROMPT = json.dumps({
    "version": 1,
    "positive": [{"id": "positive-1", "title": "全局", "text": "", "enabled": True, "collapsed": False}],
    "negative": [{"id": "negative-1", "title": "负面", "text": "", "enabled": True, "collapsed": False}],
    "settings": {"negativeEnabled": True, "autocomplete": True, "spelling": True, "underscores": False,
                 "sources": ["local", "danbooru"], "customWords": []},
}, ensure_ascii=False)


def compose_prompt(prompt_data: str, trigger_words: str = "") -> tuple[str, str]:
    try:
        value = json.loads(prompt_data)
    except (ValueError, TypeError) as exc:
        raise ValueError("RuYi 提示词：工作流提示词数据不是有效 JSON。") from exc
    if not isinstance(value, dict) or value.get("version") != 1:
        raise ValueError("RuYi 提示词：不支持的提示词数据版本。")
    settings = value.get("settings", {})
    if not isinstance(settings, dict) or not isinstance(settings.get("negativeEnabled", True), bool):
        raise ValueError("RuYi 提示词：负面提示词开关无效。")
    texts = []
    for side in ("positive", "negative"):
        sections = value.get(side)
        if not isinstance(sections, list):
            raise ValueError(f"RuYi 提示词：{side} 必须是段落列表。")
        parts = []
        for section in sections:
            if not isinstance(section, dict) or not isinstance(section.get("text"), str):
                raise ValueError(f"RuYi 提示词：{side} 存在无效段落文本。")
            if "enabled" in section and not isinstance(section["enabled"], bool):
                raise ValueError(f"RuYi 提示词：{side} 存在无效段落开关。")
            if (side != "negative" or settings.get("negativeEnabled", True)) and section.get("enabled", True) and section["text"].strip():
                parts.append(section["text"].strip())
        texts.append("\n".join(parts))
    if trigger_words.strip():
        texts[0] = "\n".join(part for part in (texts[0], trigger_words.strip()) if part)
    return tuple(texts)


class RuYiPrompt:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"clip": ("CLIP",), "prompt_data": ("RUYI_PROMPT", {"default": DEFAULT_PROMPT})},
                "optional": {"trigger_words": ("STRING", {"forceInput": True})}}

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING")
    RETURN_NAMES = ("positive", "negative")
    FUNCTION = "encode"
    CATEGORY = "RuYi-Nodes/conditioning"
    DESCRIPTION = "分段编辑正负提示词，接入 LoRA 触发词并编码为采样条件。"

    def encode(self, clip, prompt_data, trigger_words=""):
        if clip is None:
            raise ValueError("RuYi 提示词：请连接有效的 CLIP 文本编码器。")
        positive, negative = compose_prompt(prompt_data, trigger_words)
        conditions = tuple(clip.encode_from_tokens_scheduled(clip.tokenize(text)) for text in (positive, negative))
        return {"ui": {"positive_text": [positive], "negative_text": [negative], "trigger_words": [trigger_words]},
                "result": conditions}


def register_prompt_routes():
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.get("/ruyi_nodes/prompt/vocabulary")
    async def vocabulary(request):
        # Only this bundled file is exposed; there is no caller-supplied path.
        return web.FileResponse(Path(__file__).parent / "data" / "prompt" / "vocabulary.json.gz",
                                headers={"Content-Type": "application/json", "Content-Encoding": "gzip"})


NODE_CLASS_MAPPINGS = {"RuYiPrompt": RuYiPrompt}
NODE_DISPLAY_NAME_MAPPINGS = {"RuYiPrompt": "RuYi 提示词"}
