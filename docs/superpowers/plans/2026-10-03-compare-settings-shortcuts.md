# Compare settings and prompt shortcuts

Scope: implement the latest user request in custom_nodes only; no GitHub sync, commit or publish. Keep earlier changes and create runtime backups.

1. Add browser regression cases before implementation: prompt queue shortcuts with/without completion, accessible gear buttons; compare connection placeholders, preparation retained on execution, list limits and toolbar minimum width; LoRA transparent wrappers.
2. Add shared gear button rendering. Exempt Ctrl/Meta+Enter (including Shift) from prompt completion and propagation blocking, preserving ordinary editing/selection keys.
3. Add compare settings (default maximum visible rows 2; 0 shows all), halve A/B select widths, enforce toolbar/content minimum dimensions and persist settings. Derive waiting rows from connected IMAGE ports, preserve input-based naming and frame-key auto-save, and never treat placeholders as actual previews.
4. Remove LoRA outer surface/list/toolbar backgrounds while preserving card surfaces. Update all existing settings buttons to the shared accessible gear.
5. Run real browser fixtures and relevant unit tests, inspect rendered layouts and compare interactions. Update local changelog/docs only. Review the complete delta against the user request.

Rulings: direct user authorization selects in-place development without commits/worktrees. Tests run in isolated fixture pages and do not queue the user's workflow. Keep image cache limit separate from UI row count. Existing frame-specific auto-save semantics remain unchanged.

Progress: all five tasks complete. Browser regression: Prompt 34/34, Compare 11/11, LoRA 10/10 passed. Prompt engine/worker/statistics: 3 Node suites passed; Python prompt unit tests: 5 passed; Compare frontend action checks: 4 passed. JS syntax checks passed.

Review: a fresh reviewer found that assigning computeSize disables native DOM-widget growth. Added a regression reproducing blank space on manual height increases (RED), removed the override and retained computeLayoutSize (GREEN), then reran the full Compare suite. Reviewer confirmed no remaining important issues.

Ruling: keep all live execution images while retaining the existing 128-item persisted history limit; unlimited list mode tested with 130 images and heights above 5000. Do not alter the two-image full preview cache. The UI fixture now includes native fixed/growable height allocation, avoiding the original simplified-host blind spot.

Verification artifacts: tests/runtime/compare-settings-20261003.png, runtime/settings_demo.html, backups/compare-settings-20261003. Test pages and servers are isolated from the user's running ComfyUI. Pytest is not installed; existing plain-function frontend checks ran directly and prompt tests ran through unittest. No package installation was needed. No GitHub sync, commit or publish.
