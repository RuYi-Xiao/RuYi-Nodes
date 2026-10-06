import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('ruyi_prompt_test', Path(__file__).parents[1] / 'ruyi_prompt.py')
prompt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prompt)


def data(positive, negative=()):
    return json.dumps({'version': 1, 'positive': positive, 'negative': list(negative)})


class PromptTests(unittest.TestCase):
    def test_order_disabled_sections_and_trigger_separation(self):
        value = data([{'text': '  全局, (light:1.2)\nline 2  '}, {'text': 'skip', 'enabled': False},
                      {'title': '角色名不输出', 'text': 'person two'}, {'text': ' '}], [{'text': 'bad hands'}])
        self.assertEqual(prompt.compose_prompt(value, ' @artist, style '),
                         ('全局, (light:1.2)\nline 2\nperson two\n@artist, style', 'bad hands'))
        self.assertEqual(prompt.compose_prompt(value, ' @artist, style '),
                         ('全局, (light:1.2)\nline 2\nperson two\n@artist, style', 'bad hands'))

    def test_empty_negative_is_encoded_and_conditions_are_returned_intact(self):
        class Clip:
            def __init__(self): self.texts = []
            def tokenize(self, text):
                self.texts.append(text)
                return {'text': text}
            def encode_from_tokens_scheduled(self, tokens):
                return [[tokens['text'], {'pooled_output': 'preserved', 'start_percent': 0.2}]]
        clip = Clip()
        result = prompt.RuYiPrompt().encode(clip, data([{'text': 'landscape'}]))
        self.assertEqual(clip.texts, ['landscape', ''])
        self.assertEqual(result['result'], ([['landscape', {'pooled_output': 'preserved', 'start_percent': 0.2}]],
                                           [['', {'pooled_output': 'preserved', 'start_percent': 0.2}]]))
        self.assertEqual(result['ui']['positive_text'], ['landscape'])

    def test_damaged_or_unknown_data_does_not_erase_text(self):
        for value in ['not json', '{}', '{"version":2,"positive":[],"negative":[]}',
                      '{"version":1,"positive":[{"text":5}],"negative":[]}',
                      '{"version":1,"positive":"oops","negative":[]}']:
            with self.subTest(value=value), self.assertRaises(ValueError): prompt.compose_prompt(value)

    def test_missing_clip_has_actionable_error(self):
        with self.assertRaisesRegex(ValueError, 'CLIP'):
            prompt.RuYiPrompt().encode(None, data([]))

    def test_disabled_negative_keeps_saved_text_but_outputs_empty_prompt(self):
        saved = {'version': 1, 'positive': [{'text': 'landscape'}],
                 'negative': [{'text': 'bad hands'}], 'settings': {'negativeEnabled': False}}
        self.assertEqual(prompt.compose_prompt(json.dumps(saved), 'soft light'), ('landscape\nsoft light', ''))
        self.assertEqual(saved['negative'][0]['text'], 'bad hands')
        saved['settings']['negativeEnabled'] = True
        self.assertEqual(prompt.compose_prompt(json.dumps(saved)), ('landscape', 'bad hands'))


if __name__ == '__main__': unittest.main()
