# RuYi-Nodes

[简体中文](README.zh-CN.md)

**RuYi-Nodes** is a lightweight collection of practical custom nodes for ComfyUI. The current release focuses on a metadata-aware multi-LoRA workflow and a simple STRING monitor for inspecting merged prompt text.

Current version: **v0.1.17**

## Included nodes

| Node | Input | Output | Purpose |
| --- | --- | --- | --- |
| **RuYi multi-Lora-loader** | `MODEL`, `CLIP` | `MODEL`, `CLIP`, `trigger_words` | Load multiple LoRAs with independent MODEL and CLIP strengths. |
| **RuYi multi-Lora-loader (model only)** | `MODEL` | `MODEL`, `trigger_words` | Load multiple LoRAs into MODEL only; useful for Krea2 / Flux-style workflows. |
| **RuYi text-preview** | `STRING` | `STRING` | Display the complete input STRING after execution and pass it through unchanged. |

## Highlights

- Manage multiple LoRAs inside a single node.
- Enable/disable each LoRA independently.
- Independent MODEL / CLIP strengths in the full loader.
- Reorder and delete LoRAs, or toggle all entries at once.
- In-node preview thumbnails.
- Searchable LoRA picker with separate **Folder** and **Base model** filters.
- Per-node **Show N LoRAs** viewport control (`3` by default, `0` = unlimited).
- Optional trigger-word output with de-duplication across enabled LoRAs.
- Per-LoRA **Output trigger** toggle controls whether that LoRA contributes trigger words to the STRING output.
- Trigger Words preview with copy action.
- Displays LoRA Manager `usage_tips` and `notes` metadata.
- Compact clipped metadata regions with full text available on hover.
- **Visit source** action when source metadata is available.
- LoRA Manager recommended weights can be applied when present in `usage_tips`.
- Fixed 4:5 preview crops and RAM-only low-resolution thumbnail caching for a responsive picker.
- English and Simplified Chinese localization.
- No additional Python packages are required beyond the libraries already used by a normal ComfyUI installation.
- Uses ComfyUI's native `LoraLoader` / `LoraLoaderModelOnly` for the actual LoRA loading path.

## Installation

### Option A — Git clone (recommended)

Open a terminal in `ComfyUI/custom_nodes` and run:

```bash
git clone https://github.com/RuYi-Xiao/RuYi-Nodes.git
```

Restart ComfyUI after installation.

To update later:

```bash
cd RuYi-Nodes
git pull
```

### Option B — Manual ZIP installation

1. Download the repository ZIP from GitHub.
2. Extract it into your ComfyUI `custom_nodes` directory.
3. Make sure the final directory is named `RuYi-Nodes` and contains `__init__.py` directly inside it.
4. Restart ComfyUI.

Example for ComfyUI Desktop on Windows:

```text
D:\Comfy-Desktop\ComfyUI\ComfyUI\custom_nodes\RuYi-Nodes\
├─ __init__.py
├─ ruyi_multi_lora.py
├─ pyproject.toml
├─ README.md
├─ js\
│  └─ ruyi_multi_lora.js
└─ locales\
   ├─ en\
   │  └─ nodeDefs.json
   └─ zh\
      └─ nodeDefs.json
```

After restarting ComfyUI, search for:

```text
RuYi multi-Lora-loader
RuYi multi-Lora-loader (model only)
RuYi text-preview
```

The LoRA nodes are under `RuYi-Nodes/loaders`; the text monitor is under `RuYi-Nodes/text`.

## ComfyUI-Lora-Manager integration

A current ComfyUI installation is required.

For the intended rich metadata UI, **ComfyUI-Lora-Manager by willmiao is strongly recommended**, but it is not required for the core LoRA loading function.

RuYi-Nodes intentionally does **not** import LoRA Manager's internal Python APIs. Instead, it reads LoRA Manager's `.metadata.json` sidecar files. This keeps the integration relatively small and decoupled while allowing LoRA Manager to handle metadata fetching/editing and preview management.

Expected sidecar naming:

```text
my_lora.safetensors
my_lora.metadata.json
```

Metadata fields currently consumed include:

- `model_name`
- `base_model`
- `preview_url`
- `notes`
- `civitai.trainedWords`
- `usage_tips`

If metadata is missing, core LoRA loading still works; preview and metadata enhancements simply become unavailable.

## Trigger-word output

Both LoRA loaders expose an optional `trigger_words` STRING output.

For each enabled LoRA, **Output trigger / 输出触发词** determines whether its trigger words are included. Trigger words from all selected entries are combined and de-duplicated.

Leaving `trigger_words` unconnected is valid and does not affect LoRA loading.

A common prompt workflow is:

```text
Main prompt STRING ───────────┐
                              ├─ STRING concatenate / combine ──> final prompt STRING
RuYi trigger_words STRING ───┘
                                                    │
                                                    └─> RuYi text-preview
```

`RuYi text-preview` is an output node, so it executes even when its passthrough STRING output is not connected. It is useful for checking the final merged prompt and LoRA trigger text.

## Krea2 / model-only workflow

For Krea2-style workflows where LoRAs are applied to MODEL only, use:

```text
MODEL / UNET
    │
    ▼
RuYi multi-Lora-loader (model only)
    │
    ▼
MODEL
```

Keep the text encoder / CLIP path separate unless your workflow specifically requires otherwise.

## Metadata refresh

After changing LoRA Manager metadata or previews, use **Refresh list / metadata** in the RuYi node. This also updates the serialized stack revision so the next queue refreshes the trigger-word output.

## Design notes

RuYi-Nodes keeps the loading core intentionally conservative:

- Native ComfyUI loader classes perform LoRA application.
- LoRA Manager integration is sidecar-based rather than dependent on private/internal APIs.
- The rich UI is an enhancement layer; missing metadata does not block normal LoRA loading.
- LoRA paths provided through ComfyUI, including `extra_model_paths.yaml`, junctions and symlinks, are supported through ComfyUI's normal path handling.

### Legacy Canvas Mode layering

The rich LoRA cards use ComfyUI DOMWidgets. In legacy Canvas Mode, DOMWidgets are rendered in an HTML layer above the LiteGraph canvas. As a result, ordinary canvas-rendered nodes cannot visually cover the HTML LoRA card when dragged over it. This is a frontend rendering limitation rather than a LoRA loading issue.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

RuYi-Nodes is released under the [MIT License](LICENSE).
