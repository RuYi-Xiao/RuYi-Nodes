"""Optional check against the isolated CPU ComfyUI test server on port 8200."""
import json
import time
import urllib.request

base = 'http://127.0.0.1:8200'
data = json.dumps({'version': 1, 'positive': [{'text': 'portrait, blue eyes'}],
                   'negative': [{'text': 'blurred'}]})
graph = {
    '1': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_06b_base.safetensors', 'type': 'cosmos'}},
    '2': {'class_type': 'RuYiPrompt', 'inputs': {'clip': ['1', 0], 'prompt_data': data, 'trigger_words': 'soft light'}},
    '3': {'class_type': 'PreviewAny', 'inputs': {'source': ['2', 0]}},
    '4': {'class_type': 'PreviewAny', 'inputs': {'source': ['2', 1]}},
}
def execute(expected_negative):
    request = urllib.request.Request(base + '/prompt', data=json.dumps({'prompt': graph}).encode(),
                                     headers={'Content-Type': 'application/json'})
    queued = json.load(urllib.request.urlopen(request, timeout=30))
    assert not queued.get('node_errors'), queued
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        history = json.load(urllib.request.urlopen(base + '/history/' + queued['prompt_id'], timeout=30))
        if queued['prompt_id'] in history:
            run = history[queued['prompt_id']]
            assert run['status']['status_str'] == 'success', run['status']
            ui = run['outputs']['2']
            assert ui['positive_text'] == ['portrait, blue eyes\nsoft light'], ui
            assert ui['negative_text'] == [expected_negative], ui
            assert ui['trigger_words'] == ['soft light'], ui
            assert '3' in run['outputs'] and '4' in run['outputs']
            return ui
        time.sleep(.25)
    raise TimeoutError('Isolated CPU encoding did not finish within 120 seconds')

execute('blurred')
saved = json.loads(data)
saved['settings'] = {'negativeEnabled': False}
graph['2']['inputs']['prompt_data'] = json.dumps(saved)
execute('')
assert saved['negative'][0]['text'] == 'blurred'
info = json.load(urllib.request.urlopen(base + '/object_info', timeout=30))
assert info['RuYiPrompt']['output'] == ['CONDITIONING', 'CONDITIONING']
for side in ('positive', 'negative'):
    assert info['KSamplerAdvanced']['input']['required'][side][0] == 'CONDITIONING'
print('PASS actual queued CLIP -> RuYiPrompt -> two conditioning consumers; negative enabled and disabled; sampler sockets match')
