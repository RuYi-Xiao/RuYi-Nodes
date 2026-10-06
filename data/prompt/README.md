# Local prompt vocabulary

`vocabulary.json.gz` is the runtime vocabulary. It merges the user's exported general/character CSV files and Chinese translations with the public Danbooru snapshot. Spaces and underscores are treated as the same canonical tag. Aliases, frequencies and source membership are merged; prompt spelling and completion run locally in a browser Worker.

- User exports: `danbooru_dataset_general.csv`, `danbooru_character_tags.csv`, `danbooru-0-zh.csv`. SHA256 of the two tag exports is recorded in `manifest.json`.
- Recent CSV and metadata: [PYU224/tagdb-updater](https://github.com/PYU224/tagdb-updater), generated 2026-09-28 according to its metadata. Download URLs and original SHA256 hashes are recorded in `downloads.json`.
- Rebuild: `python tools/build_prompt_vocabulary.py <directory-containing-the-three-exported-CSVs>`.
- Third-party spelling resources: [Typo.js](https://github.com/cfinke/Typo.js) and [wooorm English dictionaries](https://github.com/wooorm/dictionaries/tree/main/dictionaries/en). Full licenses are bundled in `js/prompt/vendor/TYPO-LICENSE.txt` and `EN-LICENSE.txt`. The local Typo.js adapter exports an ES module and requires dictionary text preloaded by the Worker; unused automatic XMLHttpRequest and filesystem loaders have been removed.

Additional WebUI-format tag CSVs, local export CSVs and two-column translation CSVs can be imported from the editor settings. Imports are saved in this browser's IndexedDB, independently of workflows; custom words and source enablement are saved in the workflow. Import again when moving to a different browser or computer. No automatic internet requests or updates occur at runtime.
