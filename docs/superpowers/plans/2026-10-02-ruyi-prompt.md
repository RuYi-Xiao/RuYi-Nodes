# RuYi Prompt Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan in the current checkout. The user explicitly instructed inline work to start after approving the written specification.

**Goal:** One local prompt editor with positive/negative sections, search, tag completion, spelling suggestions and two sampler-ready conditions.

**Architecture:** Python validates and merges serialized sections, then uses the standard CLIP encoding interface. A DOMWidget owns editing state; a shared module Worker indexes local vocabulary and runs offline spelling checks.

**Tech Stack:** Python standard library, existing aiohttp/ComfyUI, vanilla JavaScript, Typo.js and a local English Hunspell dictionary.

**Spec:** ../specs/2026-10-02-ruyi-prompt-design.md

## Global constraints

- Work only in the ComfyUI custom_nodes checkout; do not synchronize the GitHub checkout.
- Keep existing node interfaces and local edits; no new Python dependencies or core ComfyUI changes.
- Exactly two CONDITIONING outputs; CLIP required and STRING trigger_words optional.
- Separate positive/negative groups, merge enabled sections by order and append triggers only to positive.
- Offline vocabulary and spellchecking; preserve source information and licenses.

## Review focus

- Malformed workflow data must report an error rather than silently erase text.
- Chinese IME and textarea undo must survive highlighting and suggestions.
- Unknown tags are not automatically spelling errors; known aliases/artist names are accepted.
- Restored or duplicated widgets must not share mutable section state.
- Worker responses for old text must never modify newer text or selection.

## Task 1: Python merge, encode and local vocabulary route

Files: create ruyi_prompt.py, tests/test_prompt.py; modify __init__.py.
Interfaces: compose_prompt(prompt_data, trigger_words='') -> tuple[str,str]; RuYiPrompt.encode(clip,prompt_data,trigger_words='') -> UI plus two conditions. Local vocabulary route serves normalized bundled data.

- [x] Write unittest cases for enabled/order merging, negative separation, literal text preservation, nonaccumulating triggers, empty negative, malformed/unknown-version data and actual encoder argument/result contracts.
- [x] Run tests and confirm the missing implementation fails, then implement and rerun.
- [x] Bundle local CSV data and normalized recent sources; record provenance, SHA256 and third-party licenses.

## Task 2: Worker vocabulary and spelling engine

Files: create js/prompt/engine.mjs, js/prompt/worker.mjs, bundled dictionary/vendor resources; tests/prompt_engine.test.mjs.
Interfaces: prepareVocabulary(rows); complete(fragment,sources,limit=20); spellingRanges(text,customWords,triggers); worker messages carry request id, node editor text revision and command.

- [x] Test actual CSV/record handling, Unicode aliases, frequency ordering, capped results, current token replacement and known-tag spelling exemptions before implementing.
- [x] Load large vocabulary lazily once; keep spelling checks off the main thread; verify with Node tests and real Worker browser checks.

## Task 3: DOMWidget editor and node integration

Files: create js/ruyi_prompt.js and js/prompt/editor.mjs; extend localizations and README; create tests/prompt_ui.html and test server.
Interfaces: RUYI_PROMPT widget serializes versioned JSON; editor emits state updates; node execution UI supplies last positive/negative text and trigger preview.

- [x] Write browser checks for default sections, text merge-state serialization, search/next navigation, add/reorder/disable/delete, restore/copy independence and autocomplete insertion.
- [x] Implement matching overlay/textarea metrics, section controls, search, completion popup, spelling actions, source settings, custom words/import and execution preview.
- [x] Verify with real browser input including selection, undo, composition, scrolling and canvas scaling.

## Task 4: Integration and review

- [x] Run Python and Node suites, both browser regression pages, syntax and diff checks.
- [x] Start an isolated local test ComfyUI server if needed to import the new backend without interrupting the user's running server.
- [x] Verify real CLIP positive/negative encoding, LoRA trigger input and sampler-compatible output types; accurately distinguish encoding verification from actual image generation.
- [x] Request an independent code review, resolve material issues with regression checks, and report remaining limits with a screenshot.

## Progress

Implementation starts after the user's explicit instruction “好的，你开始做吧”. Existing main checkout is the requested deployment/test location. No worktree or GitHub synchronization is used.

### Verified result (2026-10-02)

- Python merge/encoding contract: 4 unittest cases passed. Existing image compare regressions: 9 checks passed.
- Engine and Worker suites passed, including canonical deduplication, qualified tag exemptions and concurrent CSV import persistence after Worker reload.
- Prompt browser page: 8 groups passed. LoRA browser page: 8 groups passed.
- Actual ComfyUI 1.53.10 DOMWidget verified: stable sizing despite frontend h-full injection; search highlight; native candidate insertion and Ctrl+Z; scroll offsets and text widths synchronized; CSV file picker import, Chinese completion and saved workflow/new Worker restoration.
- Local Qwen/Anima CPU encoding passed and actual queued CLIP -> RuYiPrompt -> two conditioning consumers succeeded. Both socket types match KSamplerAdvanced. No sampler/image generation was performed.
- Independent review identified stale completion acceptance, literal qualifier spelling and overlapping import index loss; all fixed and covered by regressions. Actual integration also caught and fixed automatic height growth.
- IME composition lifecycle was exercised in the browser test using composition events; an OS input-method session was not automated.
- Vocabulary: 508,152 canonical bundled records; imports are browser-local. Full third-party spelling licenses and dataset provenance are included.
- Screenshot: C:/Users/kakuy/.codex/visualizations/2026/10/02/01a0fa0a-97ee-7111-9991-c3b8757122c3/ruyi-prompt-tested.png.
- Work remains in the requested custom_nodes checkout. The GitHub checkout was not modified or synchronized. Independent test services are shut down after verification; the original port 8188 server is left running.