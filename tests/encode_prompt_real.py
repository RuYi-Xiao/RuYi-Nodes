"""Optional local CPU integration check; does not run a sampler or write images."""
import json
from pathlib import Path
import sys

core = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(core))
import comfy.options
comfy.options.enable_args_parsing()
sys.argv = [sys.argv[0], '--cpu']
import comfy.sd
import importlib.util
spec = importlib.util.spec_from_file_location('ruyi_prompt', Path(__file__).parents[1] / 'ruyi_prompt.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

path = Path('D:/AI/Models/text_encoder/qwen_3_06b_base.safetensors')
assert path.is_file()
clip = comfy.sd.load_clip(ckpt_paths=[str(path)], embedding_directory=[],
                          clip_type=comfy.sd.CLIPType.COSMOS, model_options={'load_device':__import__('torch').device('cpu'),
                                                                           'offload_device':__import__('torch').device('cpu')})
value = json.dumps({'version':1,'positive':[{'text':'portrait, blue eyes'}],'negative':[{'text':'blurred'}]})
result = module.RuYiPrompt().encode(clip,value,'soft light')
for side, conditioning in zip(['positive','negative'], result['result']):
    assert conditioning and conditioning[0][0].ndim == 3
    print(side, tuple(conditioning[0][0].shape), sorted(conditioning[0][1]))
assert result['ui']['positive_text'] == ['portrait, blue eyes\nsoft light']
print('PASS actual local CLIP positive/negative CPU encoding')
import comfy.model_management
import gc
comfy.model_management.unload_all_models()
del clip
gc.collect()
