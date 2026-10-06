# Shared dropdown and aligned Latent layout

> **For agentic workers:** Use superpowers:executing-plans to implement the user-approved design in place.

**Goal:** Give embedded RuYi dropdowns consistent rendered typography and simplify the Latent panel.

**Architecture:** Keep native ComfyUI parameter widgets. A shared DOM dropdown handles canvas scaling, selection, keyboard navigation and cleanup. Migrate Compare A/B, LoRA settings/filters and Latent presets to it; preserve existing values and persistence.

**Tech Stack:** Browser JavaScript, CSS, existing isolated UI fixtures.

**Spec:** User-approved aligned-group proposal in this conversation.

## Constraints

- Modify and test custom_nodes only; no GitHub sync, commits or publication.
- Alignment remains independent from Latent channels/layout; keep backend unchanged.
- Latent buttons are 28px high, labels align, preset actions share equal widths.
- Keep current-resolution, presets and scale groups; retain base information and put rounding help in a tooltip.

## Review focus

- Canvas zoom must scale menu typography and width with the trigger.
- Keyboard navigation skips disabled options, Escape/Tab dismiss safely.
- Menus inside the LoRA picker and Compare lightbox must not close their parent.
- Node disposal must remove open menus and listeners.
- Chinese and English must fit at the node minimum width.

## Task 1: Shared dropdown and owner integration

Files: create `js/dropdown.mjs`, test `tests/dropdown_ui.html`; modify `js/ruyi_image_compare.js`, `js/ruyi_multi_lora.js` and their fixtures/servers.

Interface: `createDropdown({label, className, options})` returns a button with `value`, `setOptions(records)`, `close()`, `dispose()`, `containsTarget(target)`; records contain `value`, `label`, optional `disabled`. User selection emits `change`; programmatic assignment does not.

- [x] Add failing browser coverage for scaling, keyboard behavior, dismissal and owner lifecycle.
- [x] Implement the component and migrate owners.
- [x] Run shared, Compare and LoRA UI fixtures.

## Task 2: Aligned Latent panel

Files: modify `js/ruyi_empty_latent.js`, `tests/latent_ui.html`.

- [x] Add layout assertions before implementation.
- [x] Use shared presets; align current-resolution and scale rows, equalize preset action buttons, remove permanent rounding line.
- [x] Verify preset storage, scaling, linked-input protection, language fit and layout.

## Completion

- [x] Run prompt regression and syntax checks; review the final changes.
- [x] Update local changelog, capture the resulting panel and stop fixture servers.

## Verification record

Shared dropdown 6, Latent 16, LoRA 11, Compare 12 and Prompt 35 browser checks passed (80 total). Latent backend 4 tests and dimension/Prompt JavaScript suites passed. Fresh review found the Compare lightbox stacking defect; a hit-test regression failed before the z-index repair and passed afterwards. No backend/type/alignment changes, GitHub sync or publication. Backups and screenshots are in tests/runtime.
