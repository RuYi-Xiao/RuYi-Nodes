from .ruyi_multi_lora import (
    NODE_CLASS_MAPPINGS as LORA_NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as LORA_NODE_DISPLAY_NAME_MAPPINGS,
)
from .ruyi_image_compare import (
    NODE_CLASS_MAPPINGS as IMAGE_COMPARE_NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as IMAGE_COMPARE_NODE_DISPLAY_NAME_MAPPINGS,
)
from .ruyi_prompt import RuYiPrompt, register_prompt_routes
from .ruyi_empty_latent import RuYiEmptyLatentImage

NODE_CLASS_MAPPINGS = {
    **LORA_NODE_CLASS_MAPPINGS,
    **IMAGE_COMPARE_NODE_CLASS_MAPPINGS,
    "RuYiPrompt": RuYiPrompt,
    "RuYiEmptyLatentImage": RuYiEmptyLatentImage,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **LORA_NODE_DISPLAY_NAME_MAPPINGS,
    **IMAGE_COMPARE_NODE_DISPLAY_NAME_MAPPINGS,
    "RuYiPrompt": "RuYi 提示词",
    "RuYiEmptyLatentImage": "RuYi 空Latent图像",
}

register_prompt_routes()

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
