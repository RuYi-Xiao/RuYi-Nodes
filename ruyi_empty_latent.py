import math

import torch
import comfy.model_management


MAX_RESOLUTION = 16384
LATENT_TYPES = ['SD3 / Flux (16)', 'Anima (16)', 'SD1 / SDXL (4)']
ALIGNMENTS = ['8', '16', '32', '64']


class RuYiEmptyLatentImage:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'width': ('INT', {'default': 1024, 'min': 16, 'max': MAX_RESOLUTION, 'step': 8}),
            'height': ('INT', {'default': 1024, 'min': 16, 'max': MAX_RESOLUTION, 'step': 8}),
            'batch_size': ('INT', {'default': 1, 'min': 1, 'max': 4096}),
            'alignment': (ALIGNMENTS, {'default': '16'}),
            'latent_type': (LATENT_TYPES, {'default': LATENT_TYPES[0]}),
        }}

    RETURN_TYPES = ('LATENT',)
    FUNCTION = 'generate'
    CATEGORY = 'RuYi/latent'
    DESCRIPTION = 'Empty latent images with resolution presets, width/height swap, alignment and proportional scaling.'

    def generate(self, width, height, batch_size=1, alignment='16', latent_type=LATENT_TYPES[0]):
        if alignment not in ALIGNMENTS or latent_type not in LATENT_TYPES:
            raise ValueError('RuYi 空Latent图像：无效的分辨率对齐或 Latent 类型。')
        if any(not isinstance(v, int) or isinstance(v, bool) for v in (width, height, batch_size)):
            raise ValueError('RuYi 空Latent图像：宽高和批次数量必须是整数。')
        if not (16 <= width <= MAX_RESOLUTION and 16 <= height <= MAX_RESOLUTION and 1 <= batch_size <= 4096):
            raise ValueError('RuYi 空Latent图像：宽高或批次数量超出允许范围。')
        step = int(alignment)
        width, height = [max(step, min(MAX_RESOLUTION, math.floor(v / step + 0.5) * step)) for v in (width, height)]
        channels = 4 if latent_type == LATENT_TYPES[2] else 16
        shape = [batch_size, channels]
        if latent_type == 'Anima (16)':
            shape.append(1)
        shape.extend([height // 8, width // 8])
        latent = torch.zeros(shape, device=comfy.model_management.intermediate_device(), dtype=comfy.model_management.intermediate_dtype())
        return ({'samples': latent, 'downscale_ratio_spacial': 8},)
