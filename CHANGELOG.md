# Changelog

All notable user-facing changes to **RuYi-Nodes** will be documented in this file.

## 0.2.0 - 2026-10-02

### Added / 新增

- **RuYi Prompt / RuYi 提示词**: independent positive/negative sections and CONDITIONING outputs, optional LoRA trigger input, search highlighting/navigation, local tag completion, CSV imports, offline spelling suggestions and a custom dictionary.
- Prompt settings support font size and negative-panel visibility; sections can be named, reordered, collapsed, disabled and resized. Search and vocabulary-tag hit counts stay visible; vocabulary readiness/count live in settings.
- **RuYi Empty Latent Image / RuYi 空Latent图像**: width/height swap, resolution-only presets with save/load/delete, 8/16/32/64 alignment and proportional scaling from a stable base. Defaults to 16-channel SD3/Flux; Anima single-frame and native 4-channel layouts are selectable.
- Image Compare's enlarged view supports A/B selection and both comparison modes, with Escape/backdrop/close handling and state preservation.
- Shared grayscale styling and twelve matched English/Chinese screenshots, including both LoRA variants and the picker. The opening README gallery now includes Prompt and Empty Latent.

### Changed / 调整

- LoRA weights and visible-count fields use centered numbers with shared-frame left/right arrows. A right-aligned Settings button holds visible count, unified weight step (default 0.1) and Initial/Remember-last picker behavior.
- Resolution presets store dimensions only. Saving a different resolution adds a new entry rather than overwriting the selected preset; exact duplicates are reused.
- Latent controls size themselves to their content, removing the fixed 330px panel and 500px minimum that left unnecessary bottom space.
- Prompt and LoRA action buttons share their sizing, green add symbols and red delete crosses. Removed the redundant final-prompt preview area.
- Documented explicit `%date:yyyy-MM-dd%` folder placeholders and their required percent delimiters.

### Fixed / 修复

- LoRA enable/trigger toggles retain the cards and scroll position; numeric arrow hover is limited to the hovered arrow. Picker chevrons, option typography and padding are consistent.
- Prompt completion requires a continuous full fragment in names/translations or an exact alias, instead of dispersed-letter matches. Focus/caret/IME handling, candidate invalidation and scrolling no longer leave stale or intermittently missing suggestions.
- Spelling checks debounce while typing and retain unchanged chips to prevent flicker. Typo and search navigation reveal the selected occurrence; spelling rows have balanced spacing and a clear label.
- Prompt resizing retains its bottom padding; paragraph scrollbar width and cursor, section sizing, font layers and serialized settings remain consistent.

### Removed / 移除

- Removed the legacy **RuYi text-preview / RuYi 文本监视** testing node. Old workflows that use it should select another STRING display utility.

### Validation / 验证

- Python tests cover prompt composition/CLIP encoding, latent tensor layouts and Image Compare metadata/assets.
- JavaScript and browser fixtures cover vocabulary/completion, prompt editing/search/scroll behavior, LoRA controls and picker persistence, latent preset/scaling behavior, and enlarged comparison interactions.
- Refreshed bilingual screenshots in an isolated CPU ComfyUI instance with local example images; no image-generation model is used for the comparison demonstration.

## 0.1.22 - 2026-09-02

### Fixed

- Decoupled RuYi Image Compare's node-local A/B preview cache from ComfyUI Media Assets.
- Re-running the same Image Compare node still removes its previous compare previews and thumbnails, preserving the existing bounded Compare temp-cache behavior.
- Media Assets now receive dedicated temporary PNG copies through ComfyUI's standard `ui.images` channel, so earlier Generated/history cards are no longer invalidated when the same compare node runs again.
- Media Asset files are not tracked or deleted by RuYi's per-node preview cleanup and therefore follow ComfyUI's own temporary-asset lifecycle.
- Encoded RuYi-only compare/autosave execution metadata as an opaque JSON-string UI field. This follows ComfyUI's list-shaped UI-output contract, keeps the custom A/B payload intact after execution.py merges UI results, and prevents task summaries from counting the metadata as extra media outputs.

### Tests

- Added regression coverage proving that a previous Compare preview is removed on re-run while its corresponding ComfyUI Media Asset remains available.
- Added regression coverage for ComfyUI UI-output flattening and frontend decoding of the opaque RuYi metadata payload.

## 0.1.21 - 2026-08-31

### Added

- RuYi Image Compare now exposes its generated previews through ComfyUI's standard `ui.images` output so results appear in **Media Assets → Generated** and the task/output history.
- Candidate-image right-click actions now include **Save as... / 另存为** and **Copy image / 复制图片** using the full-resolution source PNG.

### Changed

- Renamed the candidate-thumbnail context action from **Save image** to **Save as... / 另存为** to distinguish it from RuYi's configured-path **Save / 保存** button.
- Candidate-thumbnail context actions now operate on the original full-resolution preview instead of the small JPEG thumbnail.

### Fixed

- Suppressed ComfyUI's redundant native image preview beneath the custom A/B comparison interface while keeping the same images registered in Media Assets and task history.

### Tests

- Added regression coverage for standard `ui.images` output used by ComfyUI Media Assets.
- Added frontend regression checks for native-preview suppression and full-resolution context-menu actions.

## 0.1.20 - 2026-08-30

### Fixed

- Restored RuYi Image Compare previews after switching away from and back to a workflow tab.
- Restored Multi-LoRA metadata and preview covers after workflow DOM remounts.
- Saved Image Compare PNG files now preserve ComfyUI prompt and workflow metadata, allowing them to be dragged back into ComfyUI to restore the workflow.
- Isolated Image Compare temporary preview files between different workflows to prevent nodes with matching IDs from deleting each other's previews.

### Tests

- Added regression coverage for PNG workflow metadata.
- Added regression coverage for cross-workflow temporary-preview isolation.

## 0.1.19 - 2026-08-27

### Packaging

- Added explicit MIT license metadata for Comfy Registry publication.

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

- A/B selector labels are compact `A:` / `B:` in both English and Simplified Chinese.
- Manual Save keeps its button text unchanged; the button is only disabled while the save request is in progress and is re-enabled immediately afterward.
- Per-image save status is retained across name edits and A/B changes, and is cleared automatically when that input image's content actually changes.
- Refined image-compare UI with generic folder examples in the save-name hint and wider spacing between resolution and file-size metadata.
- Reworked the compare node UI: A/B image selection uses dropdowns, the image list is a vertical management panel, and each item exposes always-visible **Display name** and **Save name** text boxes.
- Added customizable save filename tokens such as `%index%`, `%display_name%`, `%save_name%`, `%input%`, `%frame%`, and `%date:yyyy-MM-dd_HHmmss%`.
- Added per-image resolution and PNG file-size display, while keeping per-image auto-save and manual save controls.
- Per-image save filenames default to `%display_name-date:yyyy-MM-dd_HHmmss%`, while display names remain independently editable.
- Successful manual and automatic image saves print the absolute output path to the ComfyUI log.
- Simplified Chinese display names were added for both RuYi multi-LoRA loader nodes.
- Compare-mode control uses **Compare mode: Wipe / Click** and **对比方式：滑动 / 点击**.

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
- MIT license.

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
- Frontend thumbnail-cache eviction/refresh safely handles in-flight requests without leaking object URLs or deleting newer cache entries.
