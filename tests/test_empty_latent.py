import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parents[1]))
import comfy.cli_args
comfy.cli_args.args.cpu = True


class EmptyLatentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = ROOT / 'ruyi_empty_latent.py'
        if not path.exists():
            raise AssertionError('RuYi empty latent node is missing')
        spec = importlib.util.spec_from_file_location('ruyi_empty_latent_test', path)
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_native_four_channel_layout_and_zero_batch(self):
        result = self.module.RuYiEmptyLatentImage().generate(832, 1216, 2, '8', 'SD1 / SDXL (4)')[0]
        self.assertEqual(tuple(result['samples'].shape), (2, 4, 152, 104))
        self.assertEqual(result['samples'].count_nonzero().item(), 0)
        self.assertEqual(result['downscale_ratio_spacial'], 8)

    def test_sixteen_channel_layout_and_backend_alignment(self):
        result = self.module.RuYiEmptyLatentImage().generate(833, 1217, 1, '16', 'SD3 / Flux (16)')[0]
        self.assertEqual(tuple(result['samples'].shape), (1, 16, 152, 104))

    def test_anima_single_frame_layout(self):
        result = self.module.RuYiEmptyLatentImage().generate(1216, 832, 1, '16', 'Anima (16)')[0]
        self.assertEqual(tuple(result['samples'].shape), (1, 16, 1, 104, 152))

    def test_invalid_api_values_are_rejected_before_allocation(self):
        node = self.module.RuYiEmptyLatentImage()
        for args in [(0, 512, 1, '16', 'SD3 / Flux (16)'), (512, 512, 0, '16', 'SD3 / Flux (16)'),
                     (512, 512, 1, '1', 'SD3 / Flux (16)'), (512, 512, 1, '16', 'unknown')]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                node.generate(*args)


if __name__ == '__main__':
    unittest.main()
