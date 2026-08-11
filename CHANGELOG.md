# Changelog

All notable user-facing changes to **RuYi-Nodes** will be documented in this file.

## 0.1.17 - 2026-08-11

First public release.

### Added

- **RuYi multi-Lora-loader** for loading multiple LoRAs in one node with independent MODEL and CLIP strengths.
- **RuYi multi-Lora-loader (model only)** for model-only LoRA workflows such as Krea2 / Flux-style pipelines.
- Optional per-LoRA **trigger-word output**, with duplicate trigger words removed while preserving LoRA order.
- **RuYi text-preview / RuYi 文本监视** for displaying a final merged STRING after execution while passing it through unchanged.
- Integration with **ComfyUI-Lora-Manager** `.metadata.json` sidecars for friendly names, base-model information, trigger words, usage tips, notes, recommended weights, preview images, and source links.
- Searchable LoRA picker with folder and base-model filters.
- Per-node **Show N LoRAs / 显示 N 个 LoRA** control; `0` disables the internal height limit.
- English and Simplified Chinese localization.
- Bilingual README files and MIT license.

### Changed

- Compact English control labels use **Model**, **CLIP**, **Output trigger**, **Enable**, and **No source** while keeping **Visit source** unchanged.
- Long trigger-word, usage-tip, and note fields are truncated in-card instead of creating nested scrollbars; full text remains available on hover.
- LoRA cards use a fixed 4:5 preview crop and a reserved scrollbar track so cards keep a stable width when internal scrolling appears.
- LoRA loading continues to use ComfyUI's native `LoraLoader` / `LoraLoaderModelOnly` path.

### Fixed

- Improved node height restoration and resizing across workflow reloads, graph zoom, and Windows DPI scaling.
- Prevented state-only controls such as enable toggles and strength edits from causing unnecessary full DOM rebuilds or node-size growth.
- Prevented LoRA cards from shrinking when additional rows are added.
- Improved compact English layout so long labels no longer clip the right-side controls.
- Simplified Chinese cards now display **触发词** consistently.

### Performance and resource usage

- Added bounded RAM-only thumbnail caches for both backend JPEG thumbnails and frontend object URLs; no thumbnail cache files are written to disk.
- Thumbnail resize/decode work runs outside the aiohttp event loop.
- The picker virtualizes very large LoRA libraries and limits thumbnail prefetching.
- Active LoRA loader caches are pruned when LoRAs are disabled, removed, replaced, or set to zero strength, preventing historical LoRA tensors from accumulating indefinitely in RAM.
- Trigger-word collection reads only the required metadata instead of resolving preview assets during workflow execution.
- LoRA catalog metadata scanning is moved off the aiohttp event loop to keep the ComfyUI server responsive on large libraries.
- Frontend thumbnail-cache eviction/refresh now safely handles in-flight requests without leaking object URLs or deleting newer cache entries.
