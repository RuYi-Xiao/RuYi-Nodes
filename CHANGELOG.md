# Changelog

All notable user-facing changes to **RuYi-Nodes** will be documented in this file.

## 0.1.18 - 2026-08-27

### Image compare save-path fixes

- Save-name fields now accept both RuYi-Compare-relative subfolders and absolute paths such as `D:\AI\Output\...`.
- Save results are shown inline beside each image's Save button instead of inserting a status row above the comparison preview.
- Save-name hover help now documents both relative-folder and absolute-path examples.

### Added

- **RuYi image-compare / RuYi 图像对比**, a visual-only comparison node with dynamic IMAGE inputs.
- Select any two connected images as **A** and **B** from compact dropdown selectors.
- **Wipe** mode for mouse-position split comparison and **Toggle** mode for click-to-switch comparison.
- Per-input custom display names and independent save-name templates, both exposed as always-visible text fields and persisted with the workflow.
- Persisted A/B selection and compare-mode state.
- Per-image save controls: individual **Auto save** toggles and **Save** buttons, with inline save-path status beside each image.
- Save-name templates support RuYi variables, relative subfolders, and absolute output paths; repeated filenames are protected from overwrite.

### Changed

- A/B selector labels are now compact `A:` / `B:` in both English and Simplified Chinese.
- Manual Save keeps its button text unchanged; the button is only disabled while the save request is in progress and is re-enabled immediately afterward.
- Per-image save status is retained across name edits and A/B changes, and is cleared automatically when that input image's content actually changes.
- Refined image-compare UI with generic folder examples in the save-name hint and wider spacing between resolution and file-size metadata.
- Reworked the compare node UI: A/B image selection uses dropdowns, the image list is a vertical management panel, and each item exposes always-visible **Display name** and **Save name** text boxes.
- Added customizable save filename tokens such as `%index%`, `%display_name%`, `%save_name%`, `%input%`, `%frame%`, and `%date:yyyy-MM-dd_HHmmss%`.
- Added per-image resolution and PNG file-size display, while keeping per-image auto-save and manual save controls.

- Removed the global filename-format row above the comparison area; filename patterns are now configured only in each image's persistent **Save name / 保存文件名** field.
- Clarified the save-name hover hint by separating user-filled RuYi variables (`%display_name%`, `%save_name%`) from automatically generated variables (`%index%`, `%input%`, `%frame%`, `%date:...%`).
- Image-compare filename preview text above the comparison area was removed; filename-token help now appears as a hover hint on filename fields.
- Per-image save filenames now default to `%display_name-date:yyyy-MM-dd_HHmmss%`, while display names remain independently editable.
- The image-management list now opens tall enough to show two complete image rows.
- Successful manual and automatic image saves now print the absolute output path to the ComfyUI log.
- Simplified Chinese display names were added for both RuYi multi-LoRA loader nodes.
- Compare-mode control now uses clearer labels: **Compare mode: Wipe / Click** and **对比方式：滑动 / 点击**.
- Removed the standalone **Swap A/B / 交换** button; A and B are selected directly from dropdowns.

### Fixed

- Reworked multi-image input collection to use ComfyUI native V3 **Autogrow**, fixing cases where several visible IMAGE connections could execute as only one backend input.

### Performance and resource usage

- Generates small JPEG thumbnails for all comparison candidates while keeping full-resolution browser references limited to the current A/B pair.
- Removes the previous execution's generated compare previews after a new result is prepared, preventing repeated runs from accumulating node-specific temp files.
- Uses ComfyUI's native V3 **Autogrow** IMAGE inputs so every connected image is collected reliably without custom port bookkeeping.

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
