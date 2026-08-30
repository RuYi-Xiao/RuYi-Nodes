import { app } from "../../scripts/app.js";

const RUYI_WIDGET_TYPE = "RUYI_LORA_STACK";
const RUYI_NODE_NAMES = new Set([
    "RuYiMultiLoraLoader",
    "RuYiMultiLoraLoaderModelOnly",
]);

const MIN_NODE_WIDTH = 700;
const PICKER_MAX_HEIGHT = 600;
const PICKER_ROW_HEIGHT = 118;
const PICKER_OVERSCAN = 12;
const PICKER_PREFETCH_MAX = 120;
const PICKER_VIRTUALIZE_THRESHOLD = 180;
const THUMBNAIL_CACHE_MAX = 512;
const PANEL_SIDE_INSET = 20;
const LIST_SCROLL_TRACK = 10;
const RESTORE_FIT_MAX_FRAMES = 60;
const ESTIMATED_TOOLBAR_HEIGHT = 42;
const ESTIMATED_ROW_HEIGHT = 165;
const ESTIMATED_ROW_GAP = 7;

const metadataCache = new Map();
let loraCatalogPromise = null;
let styleInstalled = false;
let activePickerCleanup = null;

const thumbnailObjectUrlCache = new Map();
let thumbnailCacheGeneration = 0;


const I18N = {
    en: {
        addLora: "+ Add LoRA",
        toggleAll: "Toggle All",
        refresh: "Refresh list / metadata",
        showCountPrefix: "Show",
        showCountSuffix: "LoRAs",
        showCountTitle: "Maximum number of LoRA cards shown before internal scrolling. 0 = unlimited.",
        hint: "Preview and metadata are read from ComfyUI-Lora-Manager .metadata.json sidecars; LoRA loading still works without scraped metadata.",
        noPreview: "NO\nPREVIEW",
        selectLora: "Select LoRA…",
        loadingMeta: "Loading metadata…",
        triggerWords: "Trigger Words",
        loading: "Loading…",
        none: "None",
        copy: "Copy",
        usageTips: "Usage Tips:",
        notes: "Notes:",
        strength: "Model",
        clipStrength: "CLIP",
        outputTriggers: "Output trigger",
        onOff: "Enable",
        useRecommended: "Use recommended",
        recommended: "Recommended",
        moveUp: "Move up",
        moveDown: "Move down",
        remove: "Delete",
        enable: "Enable LoRA",
        visitSource: "Visit source",
        unknownSource: "No source",
        filterPlaceholder: "Filter list… (search LoRA name or file path)",
        allFolders: "All folders",
        allBaseModels: "All base models",
        baseModel: "Base model",
        folder: "Folder",
        unknown: "Unknown",
        noMatches: "No matching LoRAs",
        emptyList: 'No LoRA added. Click "+ Add LoRA".',
    },
    zh: {
        addLora: "+ 添加 LoRA",
        toggleAll: "全部开/关",
        refresh: "刷新列表/资料",
        showCountPrefix: "显示",
        showCountSuffix: "个 LoRA",
        showCountTitle: "内部滚动前最多完整显示的 LoRA 块数量。0 = 不限高。",
        hint: "封面与资料读取 ComfyUI-Lora-Manager 的 .metadata.json；未刮削也不影响 LoRA 加载。",
        noPreview: "无封面",
        selectLora: "选择 LoRA…",
        loadingMeta: "读取资料…",
        triggerWords: "触发词",
        loading: "读取中…",
        none: "无",
        copy: "复制",
        usageTips: "使用提示：",
        notes: "附加备注：",
        strength: "权重",
        clipStrength: "CLIP 权重",
        outputTriggers: "输出触发词",
        onOff: "开/关",
        useRecommended: "用推荐权重",
        recommended: "推荐",
        moveUp: "上移",
        moveDown: "下移",
        remove: "删除",
        enable: "启用此 LoRA",
        visitSource: "访问发布页",
        unknownSource: "未知来源",
        filterPlaceholder: "Filter list…（搜索 LoRA 名称或文件路径）",
        allFolders: "全部文件夹",
        allBaseModels: "全部基础模型",
        baseModel: "基础模型",
        folder: "文件夹",
        unknown: "未知",
        noMatches: "没有匹配的 LoRA",
        emptyList: '尚未添加 LoRA。点击“+ 添加 LoRA”。',
    },
};

function getComfyLocale() {
    let value = "";
    try { value = app.extensionManager?.setting?.get?.("Comfy.Locale") || ""; } catch {}
    try { value ||= app.ui?.settings?.getSettingValue?.("Comfy.Locale") || ""; } catch {}
    value ||= document.documentElement?.lang || navigator.language || "en";
    return String(value).toLowerCase().startsWith("zh") ? "zh" : "en";
}

function tr(key) {
    const lang = getComfyLocale();
    return I18N[lang]?.[key] ?? I18N.en[key] ?? key;
}

function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;

    const style = document.createElement("style");
    style.textContent = `
      .ruyi-lora-panel {
        box-sizing: border-box;
        min-width: 0;
        color: var(--fg-color, #ddd);
        font: 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
        padding: 0;
        overflow: visible;
      }
      .ruyi-lora-surface {
        box-sizing: border-box;
        min-width: 0;
        color: inherit;
        padding: 4px 10px 7px;
        overflow: hidden;
      }
      .ruyi-toolbar {
        display: grid;
        grid-template-columns: max-content max-content max-content max-content 1fr;
        gap: 6px;
        align-items: center;
        margin: 2px 0 8px;
      }
      .ruyi-toolbar button,
      .ruyi-lora-row button,
      .ruyi-picker button {
        box-sizing: border-box;
        border: 1px solid var(--border-color, #505050);
        color: var(--fg-color, #eee);
        border-radius: 5px;
        min-height: 28px;
        height: 28px;
        padding: 3px 8px;
        cursor: pointer;
        white-space: nowrap;
      }
      .ruyi-toolbar button {
        background: #404040;
        border-color: #666;
      }
      .ruyi-lora-row button,
      .ruyi-picker button {
        background: #343434;
        border-color: #5a5a5a;
      }
      .ruyi-toolbar button:hover { background: #4a4a4a; }
      .ruyi-lora-row button:hover,
      .ruyi-picker button:hover { background: #3f3f3f; }
      .ruyi-toolbar button:disabled,
      .ruyi-lora-row button:disabled { opacity: .45; cursor: default; }
      .ruyi-visible-count {
        box-sizing: border-box;
        height: 28px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 7px;
        border: 1px solid #666;
        border-radius: 5px;
        background: #404040;
        color: var(--fg-color, #eee);
        white-space: nowrap;
      }
      .ruyi-visible-count input {
        box-sizing: border-box;
        width: 48px;
        height: 22px;
        padding: 1px 4px;
        border: 1px solid #707070;
        border-radius: 4px;
        background: #343434;
        color: var(--fg-color, #eee);
        text-align: center;
      }

      .ruyi-list {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 7px;
        max-height: none;
        overflow-y: visible;
        overflow-x: hidden;
        padding: 0;
        margin: 0;
        scrollbar-width: thin;
        overscroll-behavior: contain;
      }
      /* When a per-node visible-count limit is enabled, widen only the scroll
         container into RuYi's right inset. The reserved scrollbar gutter then
         lives in that extra strip instead of taking width away from LoRA cards. */
      .ruyi-list.has-scroll-track {
        width: calc(100% + ${LIST_SCROLL_TRACK}px);
        margin-right: -${LIST_SCROLL_TRACK}px;
        scrollbar-gutter: stable;
      }
      .ruyi-list.has-scroll-track::-webkit-scrollbar { width: 8px; }
      .ruyi-list.has-scroll-track::-webkit-scrollbar-track { background: transparent; }
      .ruyi-list.has-scroll-track::-webkit-scrollbar-thumb {
        background: rgba(160,160,160,.55);
        border-radius: 8px;
        border: 2px solid transparent;
        background-clip: content-box;
      }
      .ruyi-lora-row {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        /* The list is a flex column. Cards never shrink; the per-node
           visible-count control decides when the list starts scrolling. */
        flex: 0 0 auto;
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        grid-template-rows: auto 28px;
        column-gap: 9px;
        row-gap: 6px;
        align-items: stretch;
        border: 1px solid var(--border-color, #4c4c4c);
        background: #222222;
        border-radius: 8px;
        padding: 8px;
        margin: 0;
        overflow: hidden;
      }
      .ruyi-preview {
        box-sizing: border-box;
        width: 92px;
        height: 115px;
        min-height: 115px;
        max-height: 115px;
        aspect-ratio: 4 / 5;
        border-radius: 6px;
        object-fit: cover;
        background: #252525;
        border: 1px solid #555;
        flex: 0 0 115px;
      }
      .ruyi-preview.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: #777;
        font-size: 10px;
        white-space: pre-line;
      }
      .ruyi-preview-column {
        grid-column: 1;
        grid-row: 1;
        width: 92px;
        min-width: 92px;
        height: 115px;
        min-height: 115px;
        max-height: 115px;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        align-self: start;
        justify-content: flex-start;
      }
      .ruyi-source-btn {
        grid-column: 1;
        grid-row: 2;
        box-sizing: border-box;
        width: 92px;
        min-width: 92px;
        max-width: 92px;
        height: 28px;
        min-height: 28px;
        padding: 3px 4px !important;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ruyi-row-main {
        grid-column: 2;
        grid-row: 1;
        min-width: 0;
        min-height: 115px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .ruyi-row-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
        gap: 5px;
      }
      .ruyi-lora-select {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        min-height: 28px;
        height: 28px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) max-content;
        align-items: center;
        gap: 7px;
        background: #3a3a3a;
        color: var(--fg-color, #eee);
        border: 1px solid #5a5a5a;
        border-radius: 5px;
        padding: 3px 7px;
        cursor: pointer;
        text-align: left;
      }
      .ruyi-lora-select:hover { background: #474747; }
      .ruyi-lora-select-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ruyi-lora-select-arrow { color: #aaa; font-size: 10px; }
      .ruyi-meta-line {
        display: flex;
        min-width: 0;
        gap: 7px;
        align-items: baseline;
      }
      .ruyi-meta-title {
        color: var(--fg-color, #ddd);
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1 1 auto;
        min-width: 0;
      }
      .ruyi-trigger-line {
        display: grid;
        grid-template-columns: minmax(0, 1fr) max-content;
        gap: 5px;
        align-items: start;
        min-width: 0;
      }
      .ruyi-triggers {
        color: #9ed6a6;
        line-height: 1.25;
        height: 32px;
        overflow: hidden;
        word-break: break-word;
        padding-right: 2px;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }
      .ruyi-detail-line {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: 6px;
        min-width: 0;
        align-items: start;
        color: #aaa;
        font-size: 10.5px;
        line-height: 1.2;
      }
      .ruyi-detail-label {
        color: #bdbdbd;
        white-space: nowrap;
      }
      .ruyi-detail-value {
        min-width: 0;
        max-height: 30px;
        overflow: hidden;
        word-break: break-word;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }
      .ruyi-detail-value.empty { color: #777; }

      .ruyi-controls {
        grid-column: 2;
        grid-row: 2;
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: nowrap;
        min-width: 0;
        height: 28px;
        min-height: 28px;
        margin: 0;
      }
      .ruyi-lora-row.is-disabled { opacity: 0.58; }
      .ruyi-lora-row.is-disabled .ruyi-toggle-box,
      .ruyi-lora-row.is-disabled button,
      .ruyi-lora-row.is-disabled input,
      .ruyi-lora-row.is-disabled .ruyi-lora-select { opacity: 1; }
      .ruyi-controls label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #bbb;
        white-space: nowrap;
      }
      /* English labels are naturally wider than the Chinese equivalents.
         Keep the source button wording unchanged, but use a slightly tighter
         control-row rhythm so the MODEL+CLIP loader fits the same node width. */
      .ruyi-lora-panel[data-lang="en"] .ruyi-controls { gap: 4px; }
      .ruyi-lora-panel[data-lang="en"] .ruyi-toggle-box {
        gap: 5px !important;
        padding-left: 6px;
        padding-right: 6px;
      }
      .ruyi-lora-panel[data-lang="en"] .ruyi-controls > button {
        padding-left: 7px;
        padding-right: 7px;
      }
      .ruyi-lora-panel[data-lang="en"] .ruyi-controls label,
      .ruyi-lora-panel[data-lang="en"] .ruyi-controls > button,
      .ruyi-lora-panel[data-lang="en"] .ruyi-toggle-box {
        flex-shrink: 0;
      }
      .ruyi-controls input[type=number] {
        box-sizing: border-box;
        width: 64px;
        height: 28px;
        background: #3a3a3a;
        color: var(--fg-color, #eee);
        border: 1px solid #5a5a5a;
        border-radius: 4px;
        padding: 2px 5px;
      }
      .ruyi-toggle-box {
        box-sizing: border-box;
        height: 28px;
        min-height: 28px;
        display: inline-flex !important;
        align-items: center;
        gap: 7px !important;
        padding: 3px 7px;
        border: 1px solid #5a5a5a;
        border-radius: 5px;
        background: #3a3a3a;
        color: var(--fg-color, #ddd) !important;
        white-space: nowrap;
        cursor: pointer;
      }
      .ruyi-round-toggle {
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        width: 18px;
        height: 18px;
        min-width: 18px;
        flex: 0 0 18px;
        margin: 0;
        border-radius: 50%;
        border: 1px solid #797979;
        background: #252525;
        cursor: pointer;
        transition: background-color .12s ease, box-shadow .12s ease, border-color .12s ease;
      }
      .ruyi-round-toggle:checked {
        background: #bdbdbd;
        border-color: #c6c6c6;
        box-shadow: inset 0 0 0 4px #3a3a3a;
      }
      .ruyi-round-toggle:hover { border-color: #aaa; }
      .ruyi-round-toggle:focus-visible { outline: 1px solid #aaa; outline-offset: 1px; }
      .ruyi-controls-spacer { flex: 1 1 auto; min-width: 2px; }
      .ruyi-lora-row button { background: #3a3a3a; border-color: #5a5a5a; }
      .ruyi-lora-row button:hover { background: #474747; }
      .ruyi-controls .danger { color: #f2b0b0; }
      .ruyi-empty {
        border: 1px dashed var(--border-color, #505050);
        border-radius: 7px;
        padding: 15px 12px;
        text-align: center;
        color: #888;
      }

      .ruyi-picker {
        position: fixed;
        z-index: 2147483000;
        box-sizing: border-box;
        width: min(680px, calc(100vw - 24px));
        background: var(--comfy-menu-bg, #202020);
        color: var(--fg-color, #eee);
        border: 1px solid var(--border-color, #555);
        border-radius: 8px;
        box-shadow: 0 12px 36px rgba(0,0,0,.58);
        overflow: hidden;
        font: 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .ruyi-picker-search-wrap {
        box-sizing: border-box;
        padding: 8px;
        background: #292929;
        border-bottom: 1px solid var(--border-color, #4d4d4d);
        display: grid;
        grid-template-columns: minmax(240px, 1fr) minmax(135px, .28fr) minmax(135px, .28fr);
        gap: 7px;
      }
      .ruyi-picker-search,
      .ruyi-picker-filter {
        box-sizing: border-box;
        width: 100%;
        height: 31px;
        padding: 4px 9px;
        color: var(--fg-color, #eee);
        background: var(--comfy-input-bg, #171717);
        border: 1px solid var(--border-color, #585858);
        border-radius: 5px;
        outline: none;
        min-width: 0;
      }
      .ruyi-picker-search:focus,
      .ruyi-picker-filter:focus { border-color: #777; }
      .ruyi-picker-list {
        box-sizing: border-box;
        height: min(${PICKER_MAX_HEIGHT}px, calc(100vh - 150px));
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        overscroll-behavior: contain;
        position: relative;
        contain: strict;
      }
      .ruyi-picker-spacer {
        position: relative;
        box-sizing: border-box;
        width: 100%;
      }
      .ruyi-picker-item {
        box-sizing: border-box;
        position: absolute;
        left: 4px;
        right: 4px;
        height: ${PICKER_ROW_HEIGHT - 4}px;
        display: grid;
        grid-template-columns: 70px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        padding: 6px 8px;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
      }
      .ruyi-picker-item:hover,
      .ruyi-picker-item.active {
        background: #333;
        border-color: #5a5a5a;
      }
      .ruyi-picker-thumb {
        box-sizing: border-box;
        width: 70px;
        aspect-ratio: 4 / 5;
        height: auto;
        object-fit: cover;
        background: #171717;
        border: 1px solid var(--border-color, #484848);
        border-radius: 5px;
      }
      .ruyi-picker-thumb.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #737373;
        font-size: 8px;
        text-align: center;
      }
      .ruyi-picker-info { min-width: 0; }
      .ruyi-picker-title {
        color: var(--fg-color, #eee);
        font-size: 13px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ruyi-picker-path {
        margin-top: 3px;
        color: #aaa;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ruyi-picker-meta {
        margin-top: 3px;
        font-size: 10.5px;
        line-height: 1.22;
      }
      .ruyi-picker-base-model {
        color: #9bc7ff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ruyi-picker-folder {
        margin-top: 1px;
        color: #c6a8ff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 780px) {
        .ruyi-picker-search-wrap { grid-template-columns: 1fr 1fr; }
        .ruyi-picker-search { grid-column: 1 / -1; }
      }
      .ruyi-picker-empty {
        padding: 20px 12px;
        text-align: center;
        color: #999;
      }
    `;
    document.head.appendChild(style);
}

function captureWheel(el) {
    el.addEventListener("wheel", e => {
        // Keep mouse-wheel events inside scrollable RuYi UI from reaching the
        // Comfy canvas (where they would zoom the graph instead of the list).
        e.stopPropagation();
    }, { capture: true, passive: true });
}

function thumbnailKey(lora, stamp, width, height, quality) {
    return `${lora || ""}|${stamp || 0}|${width}x${height}|q${quality}`;
}

function disposeThumbnailEntry(entry) {
    if (!entry) return;
    entry.cancelled = true;
    try { entry.controller?.abort(); } catch {}
    if (entry.url) {
        try { URL.revokeObjectURL(entry.url); } catch {}
        entry.url = null;
    }
}

function pruneThumbnailCache() {
    while (thumbnailObjectUrlCache.size > THUMBNAIL_CACHE_MAX) {
        const first = thumbnailObjectUrlCache.keys().next().value;
        const entry = thumbnailObjectUrlCache.get(first);
        thumbnailObjectUrlCache.delete(first);
        disposeThumbnailEntry(entry);
    }
}

function clearThumbnailCache() {
    thumbnailCacheGeneration++;
    for (const entry of thumbnailObjectUrlCache.values()) {
        disposeThumbnailEntry(entry);
    }
    thumbnailObjectUrlCache.clear();
}

function getThumbnailObjectUrl(lora, stamp, width, height, quality) {
    if (!lora) return Promise.resolve(null);
    const key = thumbnailKey(lora, stamp, width, height, quality);
    const existing = thumbnailObjectUrlCache.get(key);
    if (existing) {
        thumbnailObjectUrlCache.delete(key);
        thumbnailObjectUrlCache.set(key, existing);
        return existing.promise;
    }

    const generation = thumbnailCacheGeneration;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const entry = { url: null, promise: null, controller, cancelled: false, generation };
    entry.promise = fetch(
        `/ruyi_nodes/lora_preview?name=${encodeURIComponent(lora)}&v=${stamp || 0}&w=${width}&h=${height}&q=${quality}`,
        { cache: "no-store", ...(controller ? { signal: controller.signal } : {}) },
    )
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const stillCurrent = !entry.cancelled
                && generation === thumbnailCacheGeneration
                && thumbnailObjectUrlCache.get(key) === entry;
            if (!stillCurrent) {
                try { URL.revokeObjectURL(url); } catch {}
                return null;
            }
            entry.url = url;
            pruneThumbnailCache();
            return url;
        })
        .catch(err => {
            // An older in-flight request must never delete a newer cache entry
            // that reused the same key after Refresh / eviction.
            if (thumbnailObjectUrlCache.get(key) === entry) {
                thumbnailObjectUrlCache.delete(key);
            }
            if (err?.name === "AbortError") return null;
            throw err;
        });
    thumbnailObjectUrlCache.set(key, entry);
    pruneThumbnailCache();
    return entry.promise;
}

async function setCachedThumbnail(img, item, width, height, quality) {
    if (!item?.lora || !item?.preview_available) return false;
    const key = thumbnailKey(item.lora, item.preview_mtime || 0, width, height, quality);
    img.dataset.ruyiThumbKey = key;

    // If a prior row/card already loaded this thumbnail, assign the stable
    // in-memory object URL synchronously before the next paint. This prevents
    // visible cover flashes when RuYi rebuilds a card after Add/Select.
    const cached = thumbnailObjectUrlCache.get(key);
    if (cached?.url) {
        img.src = cached.url;
        return true;
    }

    try {
        const url = await getThumbnailObjectUrl(item.lora, item.preview_mtime || 0, width, height, quality);
        if (!url || !img.isConnected || img.dataset.ruyiThumbKey !== key) return false;
        img.src = url;
        try { await img.decode?.(); } catch {}
        return true;
    } catch {
        return false;
    }
}

async function prefetchPickerThumbnails(items) {
    const targets = items.filter(x => x?.preview_available).slice(0, PICKER_PREFETCH_MAX);
    const concurrency = 4;
    let cursor = 0;
    const worker = async () => {
        while (cursor < targets.length) {
            const item = targets[cursor++];
            try {
                await getThumbnailObjectUrl(item.lora, item.preview_mtime || 0, 96, 120, 62);
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length || 1) }, worker));
}

async function getLoraCatalog(force = false) {
    if (!loraCatalogPromise || force) {
        loraCatalogPromise = fetch("/ruyi_nodes/loras?details=1", { cache: "no-store" })
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(d => {
                if (Array.isArray(d.items)) return d.items;
                const names = Array.isArray(d.loras) ? d.loras : [];
                return names.map(lora => ({ lora, model_name: "", base_model: "", preview_available: false }));
            })
            .catch(err => {
                console.error("[RuYi-Nodes] Failed to get LoRA catalog", err);
                return [];
            });
    }
    return loraCatalogPromise;
}

async function getMetadata(lora, force = false) {
    if (!lora) return null;
    if (!force && metadataCache.has(lora)) return metadataCache.get(lora);
    const promise = fetch(`/ruyi_nodes/lora_metadata?name=${encodeURIComponent(lora)}`, { cache: "no-store" })
        .then(r => r.json())
        .catch(err => ({ lora, exists: false, metadata_exists: false, trigger_words: [], error: String(err) }));
    metadataCache.set(lora, promise);
    return promise;
}

function normalizeState(value) {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(v => v && typeof v === "object").map(v => ({ ...v }));
    } catch (e) {
        console.warn("[RuYi-Nodes] Invalid LoRA stack state; resetting", e);
        return [];
    }
}

function serializeState(state) {
    return JSON.stringify(state.map(row => {
        const clean = { ...row };
        delete clean._meta_rev;
        return clean;
    }));
}

function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function basename(path) {
    const parts = String(path || "").split(/[\\/]/);
    return parts[parts.length - 1] || "";
}

function stripExtension(name) {
    return String(name || "").replace(/\.(safetensors|ckpt|pt|bin)$/i, "");
}

function friendlyFallback(lora) {
    return stripExtension(basename(lora)) || tr("selectLora");
}

function recommendedText(meta, modelOnly) {
    const u = meta?.usage_tips || {};
    const pieces = [];
    if (u.strength !== undefined && u.strength !== null) pieces.push(`${tr("strength")} ${u.strength}`);
    else if (u.strength_range) pieces.push(`${tr("strength")} ${u.strength_range}`);
    else if (u.strength_min !== undefined || u.strength_max !== undefined) {
        pieces.push(`${tr("strength")} ${u.strength_min ?? "?"}-${u.strength_max ?? "?"}`);
    }
    if (!modelOnly && u.clip_strength !== undefined && u.clip_strength !== null) {
        pieces.push(`${tr("clipStrength")} ${u.clip_strength}`);
    }
    return pieces.length ? `${tr("recommended")}：${pieces.join(" · ")}` : "";
}

function usageTipsText(meta, modelOnly) {
    const u = meta?.usage_tips || {};
    const parts = [];
    if (u.strength_range) parts.push(`${tr("strength")} ${u.strength_range}`);
    else if (u.strength_min !== undefined || u.strength_max !== undefined) {
        parts.push(`${tr("strength")} ${u.strength_min ?? "?"}-${u.strength_max ?? "?"}`);
    }
    if (u.strength !== undefined && u.strength !== null) parts.push(`${tr("recommended")} ${u.strength}`);
    if (!modelOnly && u.clip_strength !== undefined && u.clip_strength !== null) parts.push(`${tr("clipStrength")} ${u.clip_strength}`);
    if (u.clip_skip !== undefined && u.clip_skip !== null) parts.push(`Clip Skip ${u.clip_skip}`);
    return parts.join(" · ");
}

function applyRecommended(row, meta, modelOnly) {
    const u = meta?.usage_tips || {};
    if (u.strength !== undefined && Number.isFinite(Number(u.strength))) {
        row.strength_model = Number(u.strength);
    }
    if (!modelOnly && u.clip_strength !== undefined && Number.isFinite(Number(u.clip_strength))) {
        row.strength_clip = Number(u.clip_strength);
    }
}

function placePicker(picker, anchor) {
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const width = Math.min(680, vw - 24);
    picker.style.width = `${width}px`;

    let left = rect.left;
    left = Math.max(12, Math.min(left, vw - width - 12));
    picker.style.left = `${left}px`;

    // Measure after insertion. Prefer below; if there is not enough room, open above.
    const pickerH = Math.min(picker.scrollHeight || 480, vh - 24);
    const below = vh - rect.bottom - margin;
    const above = rect.top - margin;
    let top;
    if (below >= Math.min(320, pickerH) || below >= above) {
        top = Math.min(rect.bottom + 4, vh - pickerH - 12);
    } else {
        top = Math.max(12, rect.top - pickerH - 4);
    }
    picker.style.top = `${Math.max(12, top)}px`;
}

function openLoraPicker(anchor, catalog, selectedLora, onChoose) {
    activePickerCleanup?.();

    const picker = make("div", "ruyi-picker");
    const searchWrap = make("div", "ruyi-picker-search-wrap");
    const search = make("input", "ruyi-picker-search");
    search.type = "text";
    search.placeholder = tr("filterPlaceholder");
    search.value = "";

    const folderFilter = make("select", "ruyi-picker-filter");
    const modelFilter = make("select", "ruyi-picker-filter");

    const folderValues = [...new Set(catalog.map(x => x.folder || "").filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    const modelValues = [...new Set(catalog.map(x => x.model_type || x.base_model || "Unknown"))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    folderFilter.append(new Option(tr("allFolders"), ""));
    for (const value of folderValues) folderFilter.append(new Option(value, value));
    modelFilter.append(new Option(tr("allBaseModels"), ""));
    for (const value of modelValues) modelFilter.append(new Option(value || tr("unknown"), value || "Unknown"));

    searchWrap.append(search, folderFilter, modelFilter);
    picker.append(searchWrap);

    const pickerList = make("div", "ruyi-picker-list");
    const spacer = make("div", "ruyi-picker-spacer");
    pickerList.append(spacer);
    captureWheel(pickerList);
    picker.append(pickerList);
    document.body.append(picker);

    let filtered = [];
    let activeIndex = -1;
    let rafPending = false;
    let useVirtual = false;
    let prefetchTimer = 0;
    let prefetchGeneration = 0;

    const matches = item => {
        const q = search.value.trim().toLocaleLowerCase();
        const folder = folderFilter.value;
        const modelType = modelFilter.value;
        if (folder && (item.folder || "") !== folder) return false;
        if (modelType && (item.model_type || item.base_model || "Unknown") !== modelType) return false;
        if (!q) return true;
        return `${item.model_name || ""}\n${item.lora || ""}\n${item.base_model || ""}\n${item.folder || ""}`
            .toLocaleLowerCase().includes(q);
    };

    const ensureActiveVisible = () => {
        if (activeIndex < 0) return;
        const top = activeIndex * PICKER_ROW_HEIGHT;
        const bottom = top + PICKER_ROW_HEIGHT;
        if (top < pickerList.scrollTop) pickerList.scrollTop = top;
        else if (bottom > pickerList.scrollTop + pickerList.clientHeight) {
            pickerList.scrollTop = bottom - pickerList.clientHeight;
        }
    };

    const createPickerRow = (item, index) => {
        const row = make("div", "ruyi-picker-item");
        row.style.top = `${index * PICKER_ROW_HEIGHT + 2}px`;
        row.classList.toggle("active", index === activeIndex);

        const thumbWrap = make("div", "ruyi-picker-thumb placeholder", tr("noPreview"));
        row.append(thumbWrap);

        const info = make("div", "ruyi-picker-info");
        const title = make("div", "ruyi-picker-title", item.model_name || friendlyFallback(item.lora));
        const path = make("div", "ruyi-picker-path", item.lora || "");
        const metaWrap = make("div", "ruyi-picker-meta");
        const baseModelLine = make("div", "ruyi-picker-base-model", `${tr("baseModel")}：${item.base_model || tr("unknown")}`);
        const folderLine = make("div", "ruyi-picker-folder", `${tr("folder")}：${item.folder || tr("unknown")}`);
        metaWrap.append(baseModelLine, folderLine);
        info.append(title, path, metaWrap);
        row.append(info);

        row.title = item.lora || "";
        row.onclick = () => {
            onChoose(item.lora);
            cleanup();
        };

        if (item.preview_available) {
            const img = document.createElement("img");
            img.className = "ruyi-picker-thumb";
            img.loading = "eager";
            img.decoding = "async";
            img.alt = item.model_name || item.lora;
            thumbWrap.replaceWith(img);
            setCachedThumbnail(img, item, 96, 120, 62).then(ok => {
                if (!ok && img.isConnected) img.replaceWith(make("div", "ruyi-picker-thumb placeholder", tr("noPreview")));
            });
        }
        return row;
    };

    const renderWindow = () => {
        rafPending = false;
        if (!picker.isConnected) return;
        if (!filtered.length) {
            spacer.style.height = "0px";
            spacer.replaceChildren(make("div", "ruyi-picker-empty", tr("noMatches")));
            return;
        }

        // For normal-size LoRA libraries keep every picker row mounted. This is
        // the browser-native scrolling behaviour users expect: cover elements do
        // not disappear simply because the wheel/scrollbar is moving. Only very
        // large libraries switch to virtualization.
        if (!useVirtual) {
            spacer.style.height = "auto";
            const frag = document.createDocumentFragment();
            for (let i = 0; i < filtered.length; i++) {
                const row = createPickerRow(filtered[i], i);
                row.style.position = "relative";
                row.style.left = "auto";
                row.style.right = "auto";
                row.style.top = "auto";
                row.style.margin = "2px 4px";
                row.style.width = "calc(100% - 8px)";
                frag.append(row);
            }
            spacer.replaceChildren(frag);
            return;
        }

        const height = filtered.length * PICKER_ROW_HEIGHT;
        spacer.style.height = `${height}px`;
        const viewportH = pickerList.clientHeight || PICKER_MAX_HEIGHT;
        const first = Math.max(0, Math.floor(pickerList.scrollTop / PICKER_ROW_HEIGHT) - PICKER_OVERSCAN);
        const last = Math.min(filtered.length, Math.ceil((pickerList.scrollTop + viewportH) / PICKER_ROW_HEIGHT) + PICKER_OVERSCAN);

        const frag = document.createDocumentFragment();
        for (let i = first; i < last; i++) frag.append(createPickerRow(filtered[i], i));
        spacer.replaceChildren(frag);
    };

    const scheduleRenderWindow = () => {
        if (!useVirtual || rafPending) return;
        rafPending = true;
        requestAnimationFrame(renderWindow);
    };

    const applyFilters = () => {
        filtered = catalog.filter(matches);
        useVirtual = filtered.length > PICKER_VIRTUALIZE_THRESHOLD;
        const selectedIndex = filtered.findIndex(x => x.lora === selectedLora);
        activeIndex = selectedIndex >= 0 ? selectedIndex : (filtered.length ? 0 : -1);
        pickerList.scrollTop = 0;
        if (selectedIndex >= 0) {
            pickerList.scrollTop = Math.max(0, selectedIndex * PICKER_ROW_HEIGHT - PICKER_ROW_HEIGHT * 2);
        }
        renderWindow();
        // Debounce background prefetching while the user is typing/changing
        // filters. Without this, every keystroke can start another long-running
        // thumbnail warm-up pass over a different result set.
        const generation = ++prefetchGeneration;
        if (prefetchTimer) clearTimeout(prefetchTimer);
        prefetchTimer = setTimeout(() => {
            prefetchTimer = 0;
            if (!picker.isConnected || generation !== prefetchGeneration) return;
            prefetchPickerThumbnails(filtered).catch(() => {});
        }, 90);
    };

    const setActive = idx => {
        if (!filtered.length) {
            activeIndex = -1;
            renderWindow();
            return;
        }
        activeIndex = Math.max(0, Math.min(idx, filtered.length - 1));
        ensureActiveVisible();
        renderWindow();
    };

    const onDocPointer = e => {
        if (!picker.contains(e.target) && !anchor.contains(e.target)) cleanup();
    };
    const onResize = () => placePicker(picker, anchor);
    const onKey = e => {
        if (e.key === "Escape") {
            e.preventDefault();
            cleanup();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive(activeIndex + 1);
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(activeIndex <= 0 ? 0 : activeIndex - 1);
            return;
        }
        if (e.key === "Enter" && activeIndex >= 0 && filtered[activeIndex]) {
            e.preventDefault();
            onChoose(filtered[activeIndex].lora);
            cleanup();
        }
    };

    function cleanup() {
        prefetchGeneration++;
        if (prefetchTimer) {
            clearTimeout(prefetchTimer);
            prefetchTimer = 0;
        }
        if (picker.isConnected) picker.remove();
        document.removeEventListener("pointerdown", onDocPointer, true);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onResize, true);
        if (activePickerCleanup === cleanup) activePickerCleanup = null;
    }

    activePickerCleanup = cleanup;
    document.addEventListener("pointerdown", onDocPointer, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    pickerList.addEventListener("scroll", scheduleRenderWindow, { passive: true });
    search.addEventListener("input", applyFilters);
    search.addEventListener("keydown", onKey);
    folderFilter.addEventListener("change", applyFilters);
    modelFilter.addEventListener("change", applyFilters);

    applyFilters();
    placePicker(picker, anchor);
    requestAnimationFrame(() => {
        placePicker(picker, anchor);
        renderWindow();
        search.focus({ preventScroll: true });
    });
}

function createRuYiLoraWidget(node, inputName) {
    installStyles();
    const modelOnly = node.comfyClass === "RuYiMultiLoraLoaderModelOnly" || node.type === "RuYiMultiLoraLoaderModelOnly";

    let state = [];
    let loraCatalog = [];
    let widget = null;
    let renderSerial = 0;
    const panel = make("div", "ruyi-lora-panel");
    panel.dataset.lang = getComfyLocale();
    const surface = make("div", "ruyi-lora-surface");
    panel.append(surface);
    const toolbar = make("div", "ruyi-toolbar");
    const addBtn = make("button", "", tr("addLora"));
    const toggleBtn = make("button", "", tr("toggleAll"));
    const refreshBtn = make("button", "", tr("refresh"));
    const visibleCountWrap = make("label", "ruyi-visible-count");
    visibleCountWrap.title = tr("showCountTitle");
    const visiblePrefix = make("span", "", tr("showCountPrefix"));
    const visibleCountInput = document.createElement("input");
    visibleCountInput.type = "number";
    visibleCountInput.min = "0";
    visibleCountInput.max = "99";
    visibleCountInput.step = "1";
    node.properties ??= {};
    if (!Number.isFinite(Number(node.properties.ruyi_visible_lora_count))) {
        node.properties.ruyi_visible_lora_count = 3;
    }
    let visibleLoraCount = Math.max(0, Math.min(99, Math.trunc(Number(node.properties.ruyi_visible_lora_count) || 0)));
    visibleCountInput.value = String(visibleLoraCount);
    const visibleSuffix = make("span", "", tr("showCountSuffix"));
    visibleCountWrap.append(visiblePrefix, visibleCountInput, visibleSuffix);
    const filler = make("div", "");
    toolbar.append(addBtn, toggleBtn, refreshBtn, visibleCountWrap, filler);
    surface.append(toolbar);

    const list = make("div", "ruyi-list");
    captureWheel(list);
    surface.append(list);

    const minNodeWidth = MIN_NODE_WIDTH;
    let measuredPanelHeight = 96;
    let lastLogicalWidth = Math.max(minNodeWidth, Number(node.size?.[0]) || minNodeWidth);
    let layoutMeasureToken = 0;
    let disposed = false;
    let surfaceResizeObserver = null;
    let remountObserver = null;
    let restoreRenderQueued = false;
    let cardResizeObserver = null;
    let cardResizeRaf = 0;
    const getHeight = () => measuredPanelHeight;

    const estimatePanelHeight = count => {
        const rows = Math.max(0, Number(count) || 0);
        if (!rows) return 82;
        return ESTIMATED_TOOLBAR_HEIGHT
            + rows * ESTIMATED_ROW_HEIGHT
            + Math.max(0, rows - 1) * ESTIMATED_ROW_GAP
            + 12;
    };

    const getVisibleCardsHeight = cards => {
        const shown = Math.min(visibleLoraCount, cards.length);
        if (shown <= 0) return 0;

        // IMPORTANT: use layout-space dimensions, not getBoundingClientRect().
        // ComfyUI scales Canvas-mode DOMWidgets with CSS transforms. A bounding rect
        // therefore contains the current graph zoom factor and writing that value
        // back into max-height effectively applies the zoom twice. offsetHeight is
        // the element's untransformed CSS layout height, which is exactly the unit
        // expected by max-height and remains correct across graph zoom / Windows DPI.
        const style = getComputedStyle(list);
        const gap = Number.parseFloat(style.rowGap || style.gap || "0") || 0;
        let height = 0;
        for (let i = 0; i < shown; i++) {
            height += cards[i].offsetHeight;
        }
        height += Math.max(0, shown - 1) * gap;
        return Math.ceil(height);
    };

    const applyListLimit = () => {
        const cards = [...list.children].filter(el => el.classList?.contains("ruyi-lora-row"));
        const limited = visibleLoraCount > 0;

        // Reserve a thin right-side scroll track whenever a limit is active. The
        // list itself expands into the node's existing right inset, so a scrollbar
        // can appear/disappear without squeezing or shifting the LoRA cards.
        list.classList.toggle("has-scroll-track", limited);

        if (!limited) {
            list.style.maxHeight = "none";
            list.style.overflowY = "visible";
            return;
        }

        if (!cards.length || cards.length <= visibleLoraCount) {
            list.style.maxHeight = "none";
            // Keep the stable gutter active even before overflow occurs, so the
            // first appearance of the scrollbar never changes card width.
            list.style.overflowY = "auto";
            return;
        }

        const height = getVisibleCardsHeight(cards);
        list.style.maxHeight = `${height}px`;
        list.style.overflowY = "auto";
    };

    const applyListLimitAndFit = ({ preserveExistingHeight = false, waitForMount = false } = {}) => {
        requestAnimationFrame(() => {
            if (disposed) return;
            applyListLimit();
            measureAndSync({ preserveExistingHeight, waitForMount });
        });
    };

    const scheduleCardHeightRefit = () => {
        if (disposed || cardResizeRaf) return;
        cardResizeRaf = requestAnimationFrame(() => {
            cardResizeRaf = 0;
            if (disposed || !panel.isConnected) return;
            // Metadata / font / wrapping changes can alter an individual card after
            // the first render. Re-measure the first N cards in CSS layout pixels
            // and then refit the outer node. This does not rebuild any cards.
            applyListLimit();
            measureAndSync({ preserveExistingHeight: false, waitForMount: false });
        });
    };

    const observeCurrentCards = () => {
        cardResizeObserver?.disconnect();
        if (typeof ResizeObserver === "undefined") return;
        cardResizeObserver ??= new ResizeObserver(() => scheduleCardHeightRefit());
        [...list.children]
            .filter(el => el.classList?.contains("ruyi-lora-row"))
            .forEach(card => cardResizeObserver.observe(card));
    };

    const syncSurfaceWidth = () => {
        const logicalWidth = Math.max(minNodeWidth, Number(node.size?.[0]) || minNodeWidth);
        lastLogicalWidth = logicalWidth;
        // In legacy Canvas DOMWidget mode ComfyUI can rewrite the outer DOM
        // widget width when the right parameter panel opens (frontend #13068).
        // Keep RuYi's actual content width tied to the node's logical width instead
        // of the transient DOMWidget width, so clicks/checkboxes never resize cards.
        surface.style.width = `${Math.max(320, logicalWidth - PANEL_SIDE_INSET)}px`;
        surface.style.maxWidth = `${Math.max(320, logicalWidth - PANEL_SIDE_INSET)}px`;
    };

    const syncLayout = ({ preserveExistingHeight = true } = {}) => {
        if (!widget || disposed) return;
        syncSurfaceWidth();
        widget.computeLayoutSize = () => ({
            minWidth: minNodeWidth,
            minHeight: getHeight(),
        });
        widget.computeSize = width => [Math.max(minNodeWidth, width || minNodeWidth), getHeight()];

        requestAnimationFrame(() => {
            if (disposed) return;
            try {
                const currentW = Math.max(minNodeWidth, Number(node.size?.[0]) || minNodeWidth);
                const currentH = Math.max(0, Number(node.size?.[1]) || 0);
                // computeSize() is still useful for total height, but its width is
                // deliberately ignored. This prevents width drift on every state change.
                const computed = node.computeSize?.();
                const requiredH = Math.max(120, Number(computed?.[1]) || getHeight() + 70);
                // Workflow deserialization can restore a user-resized node height after
                // widget.setValue(). During restore we therefore only GROW the node to
                // the required content height and never collapse a larger saved height.
                // Structural user actions (Add/Delete) can opt into exact fitting.
                const targetH = preserveExistingHeight ? Math.max(currentH, requiredH) : requiredH;
                if (Math.abs((node.size?.[0] || 0) - currentW) > 0.5 || Math.abs(currentH - targetH) > 0.5) {
                    node.setSize?.([currentW, targetH]);
                }
                node.setDirtyCanvas?.(true, true);
                node.graph?.setDirtyCanvas?.(true, true);
            } catch (e) {
                console.debug("[RuYi-Nodes] layout sync skipped", e);
            }
        });
    };

    const measureAndSync = ({
        preserveExistingHeight = true,
        waitForMount = false,
        maxFrames = RESTORE_FIT_MAX_FRAMES,
    } = {}) => {
        const token = ++layoutMeasureToken;
        let frame = 0;

        const attempt = () => {
            requestAnimationFrame(() => {
                if (disposed || token !== layoutMeasureToken) return;
                if (!panel.isConnected) {
                    if (waitForMount && frame++ < maxFrames) attempt();
                    return;
                }

                syncSurfaceWidth();
                const actual = Math.ceil(surface.scrollHeight + 2);
                measuredPanelHeight = Math.max(72, actual);
                syncLayout({ preserveExistingHeight });
            });
        };
        attempt();
    };

    // A DOMWidget may receive its serialized value before ComfyUI has attached its
    // DOM element to the document. Observe the real surface size so that the first
    // post-mount layout pass always corrects the node height, without requiring a
    // click/Add/Delete action from the user.
    if (typeof ResizeObserver !== "undefined") {
        surfaceResizeObserver = new ResizeObserver(() => {
            if (disposed || !panel.isConnected) return;
            const actual = Math.ceil(surface.scrollHeight + 2);
            if (Math.abs(actual - measuredPanelHeight) <= 1) return;
            measuredPanelHeight = Math.max(72, actual);
            syncLayout({ preserveExistingHeight: true });
        });
        surfaceResizeObserver.observe(surface);
    }

    const queueRestoreRender = () => {
        if (disposed || restoreRenderQueued) return;
        restoreRenderQueued = true;
        queueMicrotask(() => {
            restoreRenderQueued = false;
            if (disposed) return;
            render({ fitMode: "restore" }).catch(() => {});
        });
    };

    const scheduleRenderOnRemount = () => {
        if (disposed) return;
        if (panel.isConnected) {
            queueRestoreRender();
            return;
        }
        if (remountObserver || typeof MutationObserver === "undefined") return;
        remountObserver = new MutationObserver(() => {
            if (disposed) {
                remountObserver?.disconnect();
                remountObserver = null;
                return;
            }
            if (!panel.isConnected) return;
            remountObserver.disconnect();
            remountObserver = null;
            queueRestoreRender();
        });
        remountObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
    };

    const persist = () => {
        if (!widget) return;
        widget.value = serializeState(state);
        // Setting widget.value is enough for workflow serialization / prompt input.
        // Avoid widget.callback here: on DOM widgets some frontend versions feed the
        // value straight back through setValue(), causing a full card rebuild and a
        // height re-fit even for a simple toggle/strength edit.
        // State changes must not trigger node width recalculation. Renders that
        // actually change content height call measureAndSync() explicitly.
        app.graph?.setDirtyCanvas?.(true, true);
    };

    const render = async ({ fitMode = "preserve" } = {}) => {
        const serial = ++renderSerial;
        cardResizeObserver?.disconnect();
        list.replaceChildren();

        if (!state.length) {
            list.append(make("div", "ruyi-empty", tr("emptyList")));
            applyListLimitAndFit({
                preserveExistingHeight: fitMode !== "exact",
                waitForMount: fitMode === "restore" || !panel.isConnected,
            });
            return;
        }

        state.forEach((row, index) => {
            row.enabled = row.enabled ?? row.on ?? true;
            row.lora = row.lora || row.lora_name || "";
            row.strength_model = Number(row.strength_model ?? row.strength ?? 1.0);
            if (!modelOnly) row.strength_clip = Number(row.strength_clip ?? row.strength_model ?? 1.0);
            row.include_trigger = row.include_trigger ?? true;

            const card = make("div", "ruyi-lora-row");
            card.classList.toggle("is-disabled", !row.enabled);
            const previewColumn = make("div", "ruyi-preview-column");
            const previewWrap = make("div", "ruyi-preview placeholder", tr("noPreview"));
            previewColumn.append(previewWrap);
            card.append(previewColumn);

            const sourceBtn = make("button", "ruyi-source-btn", tr("unknownSource"));
            sourceBtn.disabled = true;
            card.append(sourceBtn);

            const main = make("div", "ruyi-row-main");
            const head = make("div", "ruyi-row-head");

            const selectBtn = make("button", "ruyi-lora-select");
            const selectTitle = make("span", "ruyi-lora-select-title", friendlyFallback(row.lora));
            const selectArrow = make("span", "ruyi-lora-select-arrow", "▼");
            selectBtn.append(selectTitle, selectArrow);
            selectBtn.title = row.lora || tr("selectLora");
            selectBtn.onclick = async e => {
                e.preventDefault();
                e.stopPropagation();
                if (!loraCatalog.length) loraCatalog = await getLoraCatalog();
                openLoraPicker(selectBtn, loraCatalog, row.lora, async chosen => {
                    row.lora = chosen;
                    row._meta_rev = Date.now();
                    persist();
                    await render();
                });
            };
            head.append(selectBtn);
            main.append(head);

            const metaLine = make("div", "ruyi-meta-line");
            const metaTitle = make("div", "ruyi-meta-title", row.lora ? tr("loadingMeta") : tr("selectLora"));
            metaLine.append(metaTitle);
            main.append(metaLine);

            const triggerLine = make("div", "ruyi-trigger-line");
            const trigText = make("div", "ruyi-triggers", `${tr("triggerWords")}：${tr("loading")}`);
            const copyBtn = make("button", "", tr("copy"));
            copyBtn.disabled = true;
            triggerLine.append(trigText, copyBtn);
            main.append(triggerLine);

            const usageLine = make("div", "ruyi-detail-line");
            const usageLabel = make("span", "ruyi-detail-label", tr("usageTips"));
            const usageValue = make("div", "ruyi-detail-value empty", tr("loading"));
            usageLine.append(usageLabel, usageValue);
            main.append(usageLine);

            const notesLine = make("div", "ruyi-detail-line");
            const notesLabel = make("span", "ruyi-detail-label", tr("notes"));
            const notesValue = make("div", "ruyi-detail-value empty", tr("loading"));
            notesLine.append(notesLabel, notesValue);
            main.append(notesLine);

            const controls = make("div", "ruyi-controls");

            const modelLabel = make("label", "", tr("strength"));
            const modelStrength = document.createElement("input");
            modelStrength.type = "number";
            modelStrength.step = "0.01";
            modelStrength.min = "-100";
            modelStrength.max = "100";
            modelStrength.value = String(row.strength_model);
            modelStrength.onchange = () => {
                row.strength_model = Number(modelStrength.value);
                persist();
            };
            modelLabel.append(modelStrength);
            controls.append(modelLabel);

            if (!modelOnly) {
                const clipLabel = make("label", "", tr("clipStrength"));
                const clipStrength = document.createElement("input");
                clipStrength.type = "number";
                clipStrength.step = "0.01";
                clipStrength.min = "-100";
                clipStrength.max = "100";
                clipStrength.value = String(row.strength_clip);
                clipStrength.onchange = () => {
                    row.strength_clip = Number(clipStrength.value);
                    persist();
                };
                clipLabel.append(clipStrength);
                controls.append(clipLabel);
            }

            const triggerLabel = make("label", "ruyi-toggle-box");
            const triggerText = make("span", "", tr("outputTriggers"));
            const includeTrigger = document.createElement("input");
            includeTrigger.type = "checkbox";
            includeTrigger.className = "ruyi-round-toggle";
            includeTrigger.checked = !!row.include_trigger;
            includeTrigger.onchange = () => {
                row.include_trigger = includeTrigger.checked;
                persist();
            };
            triggerLabel.append(triggerText, includeTrigger);

            const recommendedBtn = make("button", "", tr("useRecommended"));
            recommendedBtn.style.display = "none";
            controls.append(recommendedBtn);

            const spacer = make("span", "ruyi-controls-spacer", "");
            controls.append(spacer);

            const upBtn = make("button", "", "↑");
            const downBtn = make("button", "", "↓");
            const removeBtn = make("button", "danger", tr("remove"));
            upBtn.title = tr("moveUp");
            downBtn.title = tr("moveDown");
            upBtn.disabled = index === 0;
            downBtn.disabled = index === state.length - 1;
            upBtn.onclick = async () => {
                [state[index - 1], state[index]] = [state[index], state[index - 1]];
                persist();
                await render();
            };
            downBtn.onclick = async () => {
                [state[index + 1], state[index]] = [state[index], state[index + 1]];
                persist();
                await render();
            };
            removeBtn.onclick = async () => {
                state.splice(index, 1);
                persist();
                await render({ fitMode: "exact" });
            };
            controls.append(upBtn, downBtn, triggerLabel, removeBtn);

            const enableBox = make("label", "ruyi-toggle-box ruyi-enable-box");
            const enableText = make("span", "", tr("onOff"));
            const enabled = document.createElement("input");
            enabled.type = "checkbox";
            enabled.className = "ruyi-round-toggle ruyi-enable";
            enabled.checked = !!row.enabled;
            enabled.title = tr("enable");
            enabled.setAttribute("aria-label", tr("enable"));
            enabled.onchange = () => {
                row.enabled = enabled.checked;
                card.classList.toggle("is-disabled", !row.enabled);
                persist();
            };
            enableBox.append(enableText, enabled);
            controls.append(enableBox);

            card.append(main);
            card.append(controls);
            list.append(card);

            if (row.lora) {
                getMetadata(row.lora).then(meta => {
                    if (serial !== renderSerial) return;
                    if (!card.isConnected) {
                        scheduleRenderOnRemount();
                        return;
                    }
                    const friendlyName = meta?.model_name || friendlyFallback(row.lora);
                    selectTitle.textContent = friendlyName;
                    selectBtn.title = `${friendlyName}\n${row.lora}`;

                    // Keep the physical file path visible but secondary; the selector itself
                    // now displays LoRA Manager's friendly model name.
                    metaTitle.textContent = row.lora;
                    metaTitle.title = row.lora;

                    const words = Array.isArray(meta?.trigger_words) ? meta.trigger_words : [];
                    trigText.textContent = words.length ? `${tr("triggerWords")}：${words.join(", ")}` : `${tr("triggerWords")}：${tr("none")}`;
                    trigText.title = words.join(", ");
                    copyBtn.disabled = !words.length;
                    copyBtn.onclick = async () => {
                        if (!words.length) return;
                        try {
                            await navigator.clipboard.writeText(words.join(", "));
                        } catch {
                            // Clipboard permission may be unavailable in embedded Desktop webviews.
                        }
                    };

                    const usageText = usageTipsText(meta, modelOnly);
                    usageValue.textContent = usageText || tr("none");
                    usageValue.title = usageText || tr("none");
                    usageValue.classList.toggle("empty", !usageText);

                    const notesText = String(meta?.notes || "").trim();
                    notesValue.textContent = notesText || tr("none");
                    notesValue.title = notesText || tr("none");
                    notesValue.classList.toggle("empty", !notesText);

                    const recText = recommendedText(meta, modelOnly);
                    recommendedBtn.style.display = recText ? "" : "none";
                    recommendedBtn.title = recText || tr("useRecommended");
                    recommendedBtn.onclick = async () => {
                        applyRecommended(row, meta, modelOnly);
                        persist();
                        await render();
                    };

                    if (meta?.source_url) {
                        sourceBtn.disabled = false;
                        sourceBtn.textContent = tr("visitSource");
                        sourceBtn.title = meta.source_url;
                        sourceBtn.onclick = e => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(meta.source_url, "_blank", "noopener,noreferrer");
                        };
                    } else {
                        sourceBtn.disabled = true;
                        sourceBtn.textContent = tr("unknownSource");
                        sourceBtn.title = tr("unknownSource");
                    }

                    if (meta?.preview_available) {
                        const img = document.createElement("img");
                        img.className = "ruyi-preview";
                        img.loading = "eager";
                        img.decoding = "async";
                        img.alt = friendlyName;
                        previewWrap.replaceWith(img);
                        const thumbItem = {
                            lora: row.lora,
                            preview_available: true,
                            preview_mtime: meta.preview_mtime || 0,
                        };
                        setCachedThumbnail(img, thumbItem, 128, 160, 70).then(ok => {
                            if (!img.isConnected) {
                                scheduleRenderOnRemount();
                                return;
                            }
                            if (!ok) img.replaceWith(make("div", "ruyi-preview placeholder", tr("noPreview")));
                        });
                    }
                });
            } else {
                selectTitle.textContent = tr("selectLora");
                metaTitle.textContent = tr("selectLora");
                trigText.textContent = `${tr("triggerWords")}：${tr("none")}`;
                copyBtn.disabled = true;
                usageValue.textContent = tr("none");
                usageValue.classList.add("empty");
                notesValue.textContent = tr("none");
                notesValue.classList.add("empty");
            }
        });

        observeCurrentCards();
        applyListLimitAndFit({
            preserveExistingHeight: fitMode !== "exact",
            waitForMount: fitMode === "restore" || !panel.isConnected,
        });
    };

    widget = node.addDOMWidget(inputName, RUYI_WIDGET_TYPE, panel, {
        hideOnZoom: false,
        selectOn: ["focus", "click"],
        getMinHeight: () => getHeight(),
        getHeight: () => getHeight(),
        onResize: () => {
            const logicalWidth = Math.max(minNodeWidth, Number(node.size?.[0]) || minNodeWidth);
            if (Math.abs(logicalWidth - lastLogicalWidth) > 0.5) {
                lastLogicalWidth = logicalWidth;
            }
            syncSurfaceWidth();
        },
        getValue: () => serializeState(state),
        setValue: value => {
            state = normalizeState(value);
            // Properties are restored by ComfyUI alongside widget values. Re-read the
            // per-node visible-count preference here so old workflows default to 3 and
            // saved RuYi nodes restore their own setting independently.
            const savedVisible = Number(node.properties?.ruyi_visible_lora_count);
            visibleLoraCount = Number.isFinite(savedVisible)
                ? Math.max(0, Math.min(99, Math.trunc(savedVisible)))
                : 3;
            node.properties ??= {};
            node.properties.ruyi_visible_lora_count = visibleLoraCount;
            visibleCountInput.value = String(visibleLoraCount);

            // Estimate only the visible portion, not every serialized LoRA row.
            const estimatedRows = visibleLoraCount <= 0 ? state.length : Math.min(state.length, visibleLoraCount);
            measuredPanelHeight = Math.max(72, estimatePanelHeight(estimatedRows));
            queueMicrotask(() => render({ fitMode: "restore" }));
        },
    });

    widget.serialize = true;
    widget.value = "[]";
    widget.refreshAfterWorkflowRestore = () => {
        if (disposed) return;
        if (panel.isConnected) queueRestoreRender();
        else scheduleRenderOnRemount();
    };

    visibleCountInput.onchange = () => {
        let value = Math.trunc(Number(visibleCountInput.value));
        if (!Number.isFinite(value)) value = 3;
        value = Math.max(0, Math.min(99, value));
        visibleLoraCount = value;
        visibleCountInput.value = String(value);
        node.properties ??= {};
        node.properties.ruyi_visible_lora_count = value;
        // This setting explicitly defines the visible list height, so fit exactly
        // instead of preserving a previously larger node height.
        applyListLimitAndFit({ preserveExistingHeight: false, waitForMount: !panel.isConnected });
        node.setDirtyCanvas?.(true, true);
        app.graph?.setDirtyCanvas?.(true, true);
    };

    addBtn.onclick = async () => {
        state.push({
            enabled: true,
            lora: "",
            strength_model: 1.0,
            ...(modelOnly ? {} : { strength_clip: 1.0 }),
            include_trigger: true,
        });
        persist();
        await render({ fitMode: "exact" });
    };

    toggleBtn.onclick = () => {
        const shouldEnable = state.some(r => !(r.enabled ?? r.on ?? true));
        state.forEach(r => { r.enabled = shouldEnable; });
        [...list.children].filter(el => el.classList?.contains("ruyi-lora-row")).forEach((card, index) => {
            card.classList.toggle("is-disabled", !shouldEnable);
            const toggle = card.querySelector(".ruyi-enable");
            if (toggle) toggle.checked = shouldEnable;
        });
        persist();
    };

    refreshBtn.onclick = async () => {
        metadataCache.clear();
        clearThumbnailCache();
        loraCatalogPromise = null;
        loraCatalog = await getLoraCatalog(true);
        const stamp = Date.now();
        state.forEach(r => { r._meta_rev = stamp; });
        persist();
        await render();
    };

    getLoraCatalog().then(async items => {
        loraCatalog = items;
        await render();
    });

    render();

    widget.onRemove = () => {
        disposed = true;
        layoutMeasureToken++;
        remountObserver?.disconnect();
        remountObserver = null;
        surfaceResizeObserver?.disconnect();
        cardResizeObserver?.disconnect();
        if (cardResizeRaf) cancelAnimationFrame(cardResizeRaf);
        activePickerCleanup?.();
        list.replaceChildren();
    };

    return { widget };
}

app.registerExtension({
    name: "RuYi-Nodes.MultiLoRA",

    getCustomWidgets() {
        return {
            [RUYI_WIDGET_TYPE](node, inputName) {
                return createRuYiLoraWidget(node, inputName);
            },
        };
    },

    afterConfigureGraph() {
        requestAnimationFrame(() => {
            for (const node of app.graph?._nodes || []) {
                if (!RUYI_NODE_NAMES.has(node?.comfyClass) && !RUYI_NODE_NAMES.has(node?.type)) continue;
                for (const candidate of node.widgets || []) {
                    candidate?.refreshAfterWorkflowRestore?.();
                }
            }
        });
    },

    nodeCreated(node) {
        if (!RUYI_NODE_NAMES.has(node.comfyClass) && !RUYI_NODE_NAMES.has(node.type)) return;
        const modelOnly = node.comfyClass === "RuYiMultiLoraLoaderModelOnly" || node.type === "RuYiMultiLoraLoaderModelOnly";
        const minWidth = MIN_NODE_WIDTH;
        const oldMin = Array.isArray(node.min_size) ? node.min_size : [0, 0];
        node.min_size = [Math.max(minWidth, Number(oldMin[0]) || 0), Math.max(120, Number(oldMin[1]) || 0)];

        const previousOnResize = node.onResize;
        let enforcingMinWidth = false;
        node.onResize = function(size) {
            previousOnResize?.call(this, size);
            if (enforcingMinWidth || (this.size?.[0] || 0) >= minWidth) return;
            enforcingMinWidth = true;
            try { this.setSize?.([minWidth, this.size?.[1] || 200]); } finally { enforcingMinWidth = false; }
        };

        requestAnimationFrame(() => {
            if ((node.size?.[0] || 0) < minWidth) {
                node.setSize?.([minWidth, node.size?.[1] || 200]);
                node.setDirtyCanvas?.(true, true);
            }
        });
    },
});

function createRuYiTextPreviewWidget(node) {
    const wrap = document.createElement("div");
    wrap.style.boxSizing = "border-box";
    wrap.style.width = "100%";
    wrap.style.height = "100%";
    wrap.style.padding = "6px";

    const area = document.createElement("textarea");
    area.readOnly = true;
    area.spellcheck = false;
    area.placeholder = getComfyLocale() === "zh" ? "运行工作流后显示最终合并文本…" : "Final merged text appears after execution…";
    area.style.boxSizing = "border-box";
    area.style.width = "100%";
    area.style.height = "100%";
    area.style.minHeight = "180px";
    area.style.resize = "none";
    area.style.overflow = "auto";
    area.style.border = "1px solid var(--border-color, #505050)";
    area.style.borderRadius = "5px";
    area.style.background = "var(--comfy-input-bg, #222)";
    area.style.color = "var(--fg-color, #ddd)";
    area.style.padding = "8px";
    area.style.fontFamily = "ui-monospace, SFMono-Regular, Consolas, monospace";
    area.style.fontSize = "12px";
    area.style.lineHeight = "1.35";
    wrap.append(area);

    const widget = node.addDOMWidget("preview", "ruyi_text_preview", wrap, {
        hideOnZoom: false,
        getMinHeight: () => 200,
        getHeight: () => 200,
        onResize: () => {},
    });
    widget.serialize = false;

    const setPreview = value => {
        const text = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
        area.value = String(text);
        area.title = String(text);
        node.setDirtyCanvas?.(true, true);
        app.graph?.setDirtyCanvas?.(true, true);
    };

    const previousOnExecuted = node.onExecuted;
    node.onExecuted = function(message) {
        previousOnExecuted?.call(this, message);
        if (message && Object.prototype.hasOwnProperty.call(message, "text")) {
            setPreview(message.text);
        }
    };

    return { widget, area };
}

app.registerExtension({
    name: "RuYi-Nodes.TextPreview",

    nodeCreated(node) {
        if (node.comfyClass !== "RuYiTextPreview" && node.type !== "RuYiTextPreview") return;

        const oldMin = Array.isArray(node.min_size) ? node.min_size : [0, 0];
        node.min_size = [Math.max(420, Number(oldMin[0]) || 0), Math.max(270, Number(oldMin[1]) || 0)];

        if ((node.size?.[0] || 0) < 420 || (node.size?.[1] || 0) < 270) {
            node.setSize?.([
                Math.max(420, node.size?.[0] || 420),
                Math.max(270, node.size?.[1] || 270),
            ]);
        }

        createRuYiTextPreviewWidget(node);
    },
});

