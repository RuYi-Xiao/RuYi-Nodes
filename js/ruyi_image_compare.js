import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import './theme.mjs';
import {settingsIcon} from './ui_controls.mjs';
import {createDropdown} from './dropdown.mjs';
import {normalizeZoomLimit} from './compare/camera.mjs';
import {createCompareViewport} from './compare/viewport.mjs';

const NODE_NAME = "RuYiImageCompare";
const STATE_KEY = "ruyi_image_compare";
const LAST_ITEMS_KEY = "ruyi_image_compare_last_items";
const SAVE_MANIFEST_WIDGET = "save_manifest";
const OUTPUT_SUBFOLDER = "RuYi-Compare";
const DEFAULT_TEMPLATE = "%save_name%";
const DEFAULT_SAVE_NAME_TEMPLATE = "%display_name-date:yyyy-MM-dd_HHmmss%";
const MAX_FULL_CACHE = 2;
const MAX_LABEL_LENGTH = 64;
const MAX_PERSISTED_ITEMS = 128;

const I18N = {
    en: {
        wipe: "Compare mode: Wipe",
        toggle: "Compare mode: Click",
        selectA: "A:",
        selectB: "B:",
        displayName: "Display name",
        saveName: "Save name",
        autoSave: "Auto save",
        saveNow: "Save",
        saving: "Saving...",
        saved: "Saved",
        saveFailed: "Save failed",
        noImage: "Connect image inputs and run the workflow",
        loading: "Loading preview...",
        resolution: "Resolution",
        fileSize: "File size",
        frame: "Frame",
        autosavedCount: "Auto-saved",
        autoSaved: "Auto-saved",
        saveAs: "Save as...",
        copyImage: "Copy image",
        enlarge: "Enlarge image comparison",
        close: "Close",
        settings: "Settings",
        visibleImages: "Maximum visible images",
        unlimitedImages: "0 shows all images and expands the node",
        waitingImage: "Waiting for image",
        zoom: "Image zoom percentage",
        resetView: "Reset zoom and position",
        maxZoom: "Maximum zoom percentage",
        zoomHelp: "100% fits the preview area; wheel to zoom. Move the pointer to compare; after zooming, drag the image to pan.",
        panHelp: "Move the pointer to compare; drag the image to pan. Comparison pauses while panning. Use reset to fit and center.",
        templateHelp: "RuYi variables:\nUser fields: %display_name%  %save_name%\nAuto-generated: %index%  %input%  %frame%  %date:yyyy-MM-dd_HHmmss%\nRelative folder example: Compare/%display_name-date:yyyy-MM-dd_HHmmss%\nAbsolute path example: C:\\YourFolder\\%display_name-date:yyyy-MM-dd_HHmmss%",
    },
    zh: {
        wipe: "对比方式：滑动",
        toggle: "对比方式：点击",
        selectA: "A:",
        selectB: "B:",
        displayName: "图像名称",
        saveName: "保存文件名",
        autoSave: "自动保存",
        saveNow: "保存",
        saving: "保存中...",
        saved: "已保存",
        saveFailed: "保存失败",
        noImage: "连接图像输入并运行工作流",
        loading: "正在加载预览...",
        resolution: "分辨率",
        fileSize: "文件体积",
        frame: "帧",
        autosavedCount: "本次自动保存",
        autoSaved: "已自动保存",
        saveAs: "另存为",
        copyImage: "复制图片",
        enlarge: "放大图像对比",
        close: "关闭",
        settings: "设置",
        visibleImages: "最多显示图片数",
        unlimitedImages: "0 表示不限数量，节点随图片栏位延展",
        waitingImage: "等待图像输入",
        zoom: "图像缩放百分比",
        resetView: "复位缩放与位置",
        maxZoom: "最大缩放百分比",
        zoomHelp: "100% 为适配展示区的大小；滚轮缩放，移动鼠标对比，放大后按住拖动图像平移。",
        panHelp: "移动鼠标对比，按住拖动图像平移；平移期间暂停对比，复位后适配展示区并居中。",
        templateHelp: "RuYi 可用变量：\n用户填写：%display_name%  %save_name%\n自动生成：%index%  %input%  %frame%  %date:yyyy-MM-dd_HHmmss%\n相对子目录示例：对比结果/%display_name-date:yyyy-MM-dd_HHmmss%\n绝对路径示例：C:\\YourFolder\\%display_name-date:yyyy-MM-dd_HHmmss%",
    },
};

function getComfyLocale() {
    let value = "";
    try { value = app.extensionManager?.setting?.get?.("Comfy.Locale") || ""; } catch {}
    try { value ||= app.ui?.settings?.getSettingValue?.("Comfy.Locale") || ""; } catch {}
    value ||= document.documentElement?.lang || navigator.language || "en";
    return String(value).toLowerCase().startsWith("zh") ? "zh" : "en";
}
const tr = (key) => I18N[getComfyLocale()]?.[key] ?? I18N.en[key] ?? key;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function viewUrl(info) {
    if (!info?.filename) return "";
    return api.apiURL(`/view?filename=${encodeURIComponent(info.filename)}`) + `&subfolder=${encodeURIComponent(info.subfolder || "")}&type=${encodeURIComponent(info.type || "temp")}`;
}

function withoutNativeImagePreview(data) {
    if (!data || typeof data !== "object" || !("images" in data)) return data;
    const copy = { ...data };
    delete copy.images;
    return copy;
}

function getRuYiExecutionPayload(data) {
    const wrapped = data?.ruyi_data;

    // ComfyUI UI outputs are list-shaped and execution.py flattens every UI
    // field as an iterable. Keep RuYi-only metadata as opaque JSON strings so
    // Jobs / Media Assets do not count it as another media output.
    if (Array.isArray(wrapped)) {
        const compareItems = [];
        const autosaved = [];
        for (const entry of wrapped) {
            if (typeof entry !== "string") continue;
            try {
                const payload = JSON.parse(entry);
                if (!payload || typeof payload !== "object") continue;
                if (Array.isArray(payload.compare_items)) compareItems.push(...payload.compare_items);
                if (Array.isArray(payload.autosaved)) autosaved.push(...payload.autosaved);
            } catch {}
        }
        return { compareItems, autosaved };
    }

    // Backward compatibility with the short-lived early 0.1.22 wrapper.
    if (wrapped && typeof wrapped === "object") {
        return {
            compareItems: Array.isArray(wrapped.compare_items) ? wrapped.compare_items : [],
            autosaved: Array.isArray(wrapped.autosaved) ? wrapped.autosaved : [],
        };
    }

    // Backward compatibility with 0.1.21 history entries.
    return {
        compareItems: Array.isArray(data?.compare_items) ? data.compare_items : [],
        autosaved: Array.isArray(data?.autosaved) ? data.autosaved : [],
    };
}

// ComfyUI stores executed `ui.images` in the reactive node-output store before
// invoking the node's onExecuted hook. RuYi still emits `ui.images` from Python
// so Jobs / Media Assets can index the files, but its canvas node uses the
// custom A/B compare UI instead of ComfyUI's standard preview. Custom extension
// modules are loaded before ComfyUI registers its core `executed` listener, so
// removing `images` only from this client-side event payload prevents the
// duplicate canvas preview without changing the backend history/output record.
function suppressNativePreviewForRuYiExecutedEvent(event) {
    const detail = event?.detail;
    const output = detail?.output;
    if (!(output?.ruyi_data && typeof output.ruyi_data === "object") && !Array.isArray(output?.compare_items)) return;
    detail.output = withoutNativeImagePreview(output);
}

api.addEventListener("executed", suppressNativePreviewForRuYiExecutedEvent);

let activeOriginalImageMenu = null;
let activeCompareLightboxClose = null;

function closeOriginalImageContextMenu() {
    if (!activeOriginalImageMenu) return;
    try { activeOriginalImageMenu.remove(); } catch {}
    activeOriginalImageMenu = null;
}

async function fetchOriginalImageBlob(item) {
    const url = viewUrl(item?.preview);
    if (!url) throw new Error("original-image-unavailable");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`image-fetch-failed:${response.status}`);
    return { blob: await response.blob(), url };
}

async function saveOriginalImageAs(item) {
    const { blob, url } = await fetchOriginalImageBlob(item);
    const suggestedName = String(item?.preview?.filename || `ruyi_compare_${item?.key || "image"}.png`);
    if (typeof window.showSaveFilePicker === "function") {
        const handle = await window.showSaveFilePicker({
            suggestedName,
            types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
    }
    const objectUrl = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = suggestedName;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
}

async function copyOriginalImage(item) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("clipboard-image-write-unavailable");
    const { blob } = await fetchOriginalImageBlob(item);
    let pngBlob = blob;
    if (blob.type !== "image/png") {
        const bitmap = await createImageBitmap(blob);
        try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(bitmap, 0, 0);
            pngBlob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("png-conversion-failed")), "image/png"));
        } finally {
            bitmap.close?.();
        }
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
}

function showOriginalImageContextMenu(item, clientX, clientY) {
    closeOriginalImageContextMenu();
    const menu = document.createElement("div");
    activeOriginalImageMenu = menu;
    Object.assign(menu.style, {
        position: "fixed", left: `${clientX}px`, top: `${clientY}px`, zIndex: "2147483647",
        minWidth: "150px", padding: "6px", borderRadius: "10px",
        border: "1px solid var(--ruyi-border)", background: "var(--ruyi-control-bg)",
        boxShadow: "0 8px 24px rgba(0,0,0,.35)", color: "var(--ruyi-text)",
        font: "14px/1.2 system-ui, -apple-system, Segoe UI, sans-serif",
    });
    const addAction = (label, action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        Object.assign(button.style, { width: "100%", padding: "10px 14px", border: "0", borderRadius: "7px", background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", font: "inherit" });
        button.addEventListener("pointerenter", () => { button.style.background = "rgba(255,255,255,.09)"; });
        button.addEventListener("pointerleave", () => { button.style.background = "transparent"; });
        button.addEventListener("click", async (event) => {
            event.preventDefault(); event.stopPropagation(); closeOriginalImageContextMenu();
            try { await action(); } catch (error) { if (error?.name !== "AbortError") console.warn("RuYi image action failed", error); }
        });
        menu.appendChild(button);
    };
    addAction(tr("saveAs"), () => saveOriginalImageAs(item));
    addAction(tr("copyImage"), () => copyOriginalImage(item));
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight - 8) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    setTimeout(() => {
        const dismiss = (event) => { if (!menu.contains(event.target)) { closeOriginalImageContextMenu(); document.removeEventListener("pointerdown", dismiss, true); } };
        document.addEventListener("pointerdown", dismiss, true);
    }, 0);
}

function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(2)} ${units[i]}`;
}

function defaultState() {
    return { mode: "wipe", aKey: null, bKey: null, toggleSide: "A", maxVisibleImages: 2, maxZoomPercent: 300, displayNames: {}, saveNames: {}, autoSaveKeys: {}, filenameTemplate: DEFAULT_TEMPLATE };
}

function normalizeMap(value, maxLength = MAX_LABEL_LENGTH) {
    const out = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [k, v] of Object.entries(value)) {
        const n = Number.parseInt(String(k), 10);
        if (!Number.isInteger(n) || n < 1) continue;
        const s = String(v ?? "").slice(0, maxLength);
        out[String(n)] = s;
    }
    return out;
}
function normalizeAuto(value) {
    const out = {};
    if (Array.isArray(value)) {
        for (const key of value) if (/^\d+:\d+$/.test(String(key))) out[String(key)] = true;
        return out;
    }
    if (!value || typeof value !== "object") return out;
    for (const [k, v] of Object.entries(value)) if (/^\d+:\d+$/.test(String(k)) && !!v) out[String(k)] = true;
    return out;
}
function getState(node) {
    node.properties ||= {};
    const current = node.properties[STATE_KEY] || {};
    const state = { ...defaultState(), ...current };
    state.mode = state.mode === "toggle" ? "toggle" : "wipe";
    state.maxVisibleImages = normalizeVisibleImages(state.maxVisibleImages);
    state.maxZoomPercent = normalizeZoomLimit(state.maxZoomPercent);
    state.displayNames = normalizeMap(state.displayNames || state.inputNames);
    state.saveNames = normalizeMap(state.saveNames, 256);
    state.autoSaveKeys = normalizeAuto(state.autoSaveKeys);
    state.filenameTemplate = DEFAULT_TEMPLATE;
    node.properties[STATE_KEY] = state;
    return state;
}
function normalizeVisibleImages(value) {
    const number = Number(value);
    return value != null && value !== '' && Number.isFinite(number) && number >= 0 ? Math.floor(number) : 2;
}

// Autogrow IMAGE sockets in current ComfyUI are named images.image_N;
// keep compatibility with older workflows that use image_N directly.
function compareRows(node, items) {
    const rows = [...items];
    const received = new Set(items.map(item => item.input));
    for (const input of node.inputs || []) {
        const match = /^(?:images\.)?image_(\d+)$/.exec(input.name || '');
        if (!match || input.type !== 'IMAGE' || input.link == null) continue;
        const number = Number(match[1]);
        if (number < 1 || received.has(number)) continue;
        received.add(number);
        rows.push({ key: `${number}:0`, input: number, frame: 0, pending: true });
    }
    return rows.sort((a, b) => a.input - b.input || a.frame - b.frame);
}
function manifestPayload(state) {
    return JSON.stringify({ displayNames: state.displayNames, saveNames: state.saveNames, autoSaveKeys: Object.keys(state.autoSaveKeys).filter((k) => state.autoSaveKeys[k]), filenameTemplate: DEFAULT_TEMPLATE });
}
function findManifestWidget(node) { return node.widgets?.find((w) => w?.name === SAVE_MANIFEST_WIDGET || w?.label === SAVE_MANIFEST_WIDGET) || null; }
function hideManifestWidget(node) {
    const widget = findManifestWidget(node); if (!widget) return null;
    widget.hidden = true; widget.type = "hidden"; widget.computeSize = () => [0, -4]; return widget;
}
function syncManifestWidget(node, state) {
    const widget = hideManifestWidget(node); if (!widget) return;
    const value = manifestPayload(state);
    if (widget.value !== value) widget.value = value;
    try { widget.callback?.(value); } catch {}
}
function saveState(node, state, dirty = true) {
    node.properties ||= {};
    node.properties[STATE_KEY] = { ...state, displayNames: { ...state.displayNames }, saveNames: { ...state.saveNames }, autoSaveKeys: { ...state.autoSaveKeys } };
    syncManifestWidget(node, node.properties[STATE_KEY]);
    if (dirty) { try { node.graph?.change?.(); } catch {} }
    node.setDirtyCanvas?.(true, true);
}

function cloneViewInfo(info) {
    if (!info || typeof info !== "object" || !info.filename) return null;
    return {
        filename: String(info.filename),
        subfolder: String(info.subfolder || ""),
        type: String(info.type || "temp"),
    };
}

function normalizePersistedCompareItems(items, limit = MAX_PERSISTED_ITEMS) {
    if (!Array.isArray(items)) return [];
    return items.slice(0, limit).map((item) => {
        const preview = cloneViewInfo(item?.preview);
        const thumb = cloneViewInfo(item?.thumb);
        if (!item?.key || !preview || !thumb) return null;
        return {
            key: String(item.key),
            input: Number(item.input) || 0,
            frame: Number(item.frame) || 0,
            frame_count: Math.max(1, Number(item.frame_count) || 1),
            width: Math.max(0, Number(item.width) || 0),
            height: Math.max(0, Number(item.height) || 0),
            size_bytes: Math.max(0, Number(item.size_bytes) || 0),
            content_id: item.content_id == null ? null : String(item.content_id),
            preview,
            thumb,
        };
    }).filter(Boolean);
}

function persistCompareItems(node, items) {
    node.properties ||= {};
    node.properties[LAST_ITEMS_KEY] = normalizePersistedCompareItems(items);
}

function getPersistedCompareItems(node) {
    return normalizePersistedCompareItems(node?.properties?.[LAST_ITEMS_KEY]);
}

function itemCounts(items) { const m = new Map(); for (const item of items) m.set(item.input, (m.get(item.input) || 0) + 1); return m; }
function displayLabel(item, counts, state) {
    const base = state.displayNames[String(item.input)] || `#${item.input}`;
    return (counts.get(item.input) || 0) > 1 ? `${base} · ${tr("frame")} ${Number(item.frame || 0) + 1}` : base;
}
function saveLabel(item, counts, state) {
    const base = state.saveNames[String(item.input)] || DEFAULT_SAVE_NAME_TEMPLATE;
    return (counts.get(item.input) || 0) > 1 ? `${base}_帧${Number(item.frame || 0) + 1}` : base;
}

function formatDate(pattern) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return pattern.replace(/yyyy/g, String(d.getFullYear())).replace(/MM/g, pad(d.getMonth() + 1)).replace(/dd/g, pad(d.getDate())).replace(/HH/g, pad(d.getHours())).replace(/mm/g, pad(d.getMinutes())).replace(/ss/g, pad(d.getSeconds()));
}
function sanitizeFilename(text) {
    return String(text || "").replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, " ").trim().replace(/^\.+|\.+$/g, "").replace(/^_+|_+$/g, "") || "image";
}
function renderFilenamePreview(template, item, counts, state, index = 1) {
    if (!item) return `${String(index).padStart(4, "0")}_image.png`;
    let text = String(template || DEFAULT_TEMPLATE);
    text = text.replace(/%date:([^%]+)%/g, (_, fmt) => formatDate(fmt));
    const replacements = {
        "%index%": String(index).padStart(4, "0"),
        "%display_name%": displayLabel(item, counts, state),
        "%save_name%": saveLabel(item, counts, state),
        "%name%": saveLabel(item, counts, state),
        "%input%": String(item.input),
        "%frame%": String(Number(item.frame || 0) + 1),
    };
    for (const [k, v] of Object.entries(replacements)) text = text.split(k).join(v);
    text = sanitizeFilename(text);
    return text.toLowerCase().endsWith(".png") ? text : `${text}.png`;
}

function selectResolved(items, state) {
    if (!items.length) { state.aKey = null; state.bKey = null; return { a: null, b: null }; }
    const by = new Map(items.map((it) => [it.key, it]));
    if (!by.has(state.aKey)) state.aKey = items[0].key;
    if (!by.has(state.bKey)) state.bKey = items[Math.min(1, items.length - 1)].key;
    if (items.length > 1 && state.aKey === state.bKey) {
        const other = items.find((it) => it.key !== state.aKey);
        state.bKey = other?.key || state.bKey;
    }
    return { a: by.get(state.aKey) || items[0], b: by.get(state.bKey) || items[0] };
}

function makeBtn(label) {
    const el = document.createElement("button");
    el.type = "button"; el.textContent = label;
    Object.assign(el.style, { height: "26px", padding: "0 10px", border: "1px solid var(--ruyi-border)", borderRadius: "5px", background: "var(--ruyi-control-bg)", color: "var(--ruyi-text)", font: "12px/1 system-ui, -apple-system, Segoe UI, sans-serif", cursor: "pointer" });
    el.addEventListener("pointerenter", () => { if (!el.disabled) el.style.background = "var(--ruyi-hover-bg)"; });
    el.addEventListener("pointerleave", () => { el.style.background = "var(--ruyi-control-bg)"; });
    return el;
}
function makeSelect(label) {
    const el = createDropdown({label});
    Object.assign(el.style, { boxSizing: "border-box", height: "28px", width: "85px", minWidth: "85px", flex: "0 0 85px", padding: "0 8px", border: "1px solid var(--ruyi-border)", borderRadius: "5px", background: "var(--ruyi-control-bg)", color: "var(--ruyi-text)", font: "12px/1 system-ui, -apple-system, Segoe UI, sans-serif" });
    return el;
}
function makeTextInput() {
    const el = document.createElement("input");
    el.type = "text";
    Object.assign(el.style, { height: "26px", minWidth: "0", width: "100%", padding: "0 8px", border: "1px solid var(--ruyi-border)", borderRadius: "5px", background: "var(--ruyi-control-bg)", color: "var(--ruyi-text)", font: "12px/1 system-ui, -apple-system, Segoe UI, sans-serif", boxSizing: "border-box" });
    return el;
}

function makeCompareWidget(node) {
    const container = document.createElement("div");
    Object.assign(container.style, { boxSizing: "border-box", width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--ruyi-border)", borderRadius: "6px", background: "var(--ruyi-group-bg)", color: "var(--ruyi-text)", font: "12px/1.25 system-ui, -apple-system, Segoe UI, sans-serif" });

    const toolbar = document.createElement("div");
    toolbar.dataset.compareToolbar = '';
    Object.assign(toolbar.style, { display: "flex", flex: "0 0 auto", gap: "8px", alignItems: "center", padding: "8px", borderBottom: "1px solid var(--ruyi-border)", background: "var(--ruyi-group-bg)", whiteSpace: "nowrap" });
    const aLabel = document.createElement("span"); aLabel.textContent = tr("selectA");
    const bLabel = document.createElement("span"); bLabel.textContent = tr("selectB");
    const aSelect = makeSelect(tr('selectA'));
    const bSelect = makeSelect(tr('selectB'));
    const modeButton = makeBtn(tr("wipe"));
    modeButton.style.flexShrink = '0';
    const settingsButton = settingsIcon(makeBtn(''), tr('settings'));
    const spacer = document.createElement("div"); spacer.style.flex = "1 1 auto";
    toolbar.append(aLabel, aSelect, bLabel, bSelect, spacer, modeButton, settingsButton);
    container.appendChild(toolbar);

    const settingsPanel = document.createElement('div'); settingsPanel.hidden = true;
    Object.assign(settingsPanel.style, {flex: '0 0 auto', padding: '8px', borderBottom: '1px solid var(--ruyi-border)'});
    const countLabel = document.createElement('label');
    Object.assign(countLabel.style, {display: 'flex', alignItems: 'center', gap: '8px'});
    const countText = document.createElement('span'); countText.textContent = tr('visibleImages');
    const visibleCount = document.createElement('input'); visibleCount.type = 'number'; visibleCount.min = '0'; visibleCount.step = '1';
    visibleCount.setAttribute('aria-label', tr('visibleImages'));
    Object.assign(visibleCount.style, {boxSizing: 'border-box', width: '62px', height: '28px', padding: '3px 6px', textAlign: 'center', border: '1px solid var(--ruyi-border)', borderRadius: '5px', background: 'var(--ruyi-control-bg)', color: 'inherit', font: 'inherit'});
    const countHelp = document.createElement('div'); countHelp.textContent = tr('unlimitedImages');
    Object.assign(countHelp.style, {marginTop: '6px', color: 'var(--ruyi-muted)'});
    countLabel.append(countText, visibleCount); settingsPanel.append(countLabel, countHelp); container.append(settingsPanel);
    const zoomLabel=document.createElement('label');Object.assign(zoomLabel.style,{display:'flex',alignItems:'center',gap:'8px',marginTop:'10px'});
    const zoomText=document.createElement('span');zoomText.textContent=tr('maxZoom');
    const maxZoom=document.createElement('input');maxZoom.type='number';maxZoom.min='100';maxZoom.step='10';maxZoom.setAttribute('aria-label',tr('maxZoom'));
    Object.assign(maxZoom.style,{boxSizing:'border-box',width:'72px',height:'28px',padding:'3px 6px',textAlign:'center',border:'1px solid var(--ruyi-border)',borderRadius:'5px',background:'var(--ruyi-control-bg)',color:'inherit',font:'inherit'});
    zoomLabel.append(zoomText,maxZoom,' %');settingsPanel.append(zoomLabel);

    const preview = document.createElement("div");
    Object.assign(preview.style, { position: "relative", display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: "240px" });
    container.appendChild(preview);
    const stage = document.createElement("div");
    stage.setAttribute("data-capture-wheel", "true");
    Object.assign(stage.style, { position: "relative", flex: "1 1 auto", minHeight: "240px", background: "var(--ruyi-content-bg)", overflow: "hidden", userSelect: "none", touchAction: "none", cursor: "crosshair" });
    preview.appendChild(stage);

    const enlargeButton = makeBtn("");
    enlargeButton.title = tr("enlarge"); enlargeButton.setAttribute("aria-label", tr("enlarge")); enlargeButton.disabled = true;
    enlargeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6M7 10h6M10 7v6"/></svg>';
    Object.assign(enlargeButton.style, { position: "absolute", bottom: "10px", right: "10px", zIndex: "6", width: "36px", height: "36px", padding: "6px", background: "var(--ruyi-control-bg)", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center" });
    enlargeButton.addEventListener("pointerdown", (event) => { event.stopPropagation(); });
    enlargeButton.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openLightbox(); });
    preview.appendChild(enlargeButton);

    const list = document.createElement("div");
    list.dataset.compareList = '';
    Object.assign(list.style, {boxSizing: 'border-box', flex: "0 0 0px", overflowY: "auto", overflowX: "hidden", padding: "8px", display: "flex", flexDirection: "column", gap: "8px", background: "var(--ruyi-group-bg)", borderTop: "1px solid var(--ruyi-border)" });
    container.appendChild(list);

    let minimumWidth = 480, minimumHeight = 470, disposed = false, layoutQueued = false, previousMinimum = 0, exactFit = false;
    const widget = node.addDOMWidget("ruyi_image_compare_widget", "ruyi_image_compare_widget", container, { hideOnZoom: false, canvasOnly: true, getMinHeight: () => minimumHeight, getMaxHeight: () => Number.POSITIVE_INFINITY });
    // Keep the native growable DOM-widget path. A computeSize override makes
    // LiteGraph classify this as fixed-height and wastes manual node growth.
    const originalLayoutSize = widget.computeLayoutSize;
    widget.computeLayoutSize = function (...args) {return {...originalLayoutSize?.apply(this, args), minWidth: minimumWidth - 32, minHeight: minimumHeight, maxHeight: Number.POSITIVE_INFINITY};};
    widget.serialize = false; widget.parent = node; widget.items = []; widget.fullCache = new Map(); widget.renderGeneration = 0; widget.split = 0.5; widget.state = getState(node);
    widget.savedStatus = new Map();
    widget.itemContentIds = new Map();
    const viewport=createCompareViewport(stage,preview,{
        getMode:()=>widget.state.mode,getMaxPercent:()=>widget.state.maxZoomPercent,
        onWipe:applyWipePosition,onToggle:()=>{widget.state.toggleSide=widget.state.toggleSide==='A'?'B':'A';saveState(node,widget.state);renderPreview();},
        labels:{reset:tr('resetView'),zoom:tr('zoom'),wheel:tr('zoomHelp'),pan:tr('panHelp')},
    });

    let lightbox = null;
    function fit(exact = false) {
        exactFit ||= exact;
        if (layoutQueued || disposed) return;
        layoutQueued = true;
        requestAnimationFrame(() => {
            layoutQueued = false;
            if (disposed || !container.isConnected) return;
            const rows = [...list.children];
            const count = widget.state.maxVisibleImages || rows.length;
            const shown = rows.slice(0, count);
            const listHeight = shown.length ? Math.ceil(17 + shown.reduce((sum, row) => sum + row.offsetHeight, 0) + 8 * (shown.length - 1)) : 0;
            list.style.display = rows.length ? 'flex' : 'none';
            list.style.flexBasis = `${listHeight}px`;
            list.style.height = `${listHeight}px`;
            const controlsWidth = [...toolbar.children].filter(child => child !== spacer).reduce((sum, child) => sum + child.offsetWidth, 0);
            minimumWidth = Math.max(480, Math.ceil(controlsWidth + 6 * 8 + 16 + 2 + 32));
            minimumHeight = 2 + 45 + (settingsPanel.hidden ? 0 : settingsPanel.offsetHeight) + 240 + listHeight;
            const height = Math.ceil(node.computeSize?.()[1] || minimumHeight + 70 + (node.inputs?.length || 0) * 20);
            node.min_size = [minimumWidth, height];
            const shrink = exactFit || (previousMinimum && node.size?.[1] <= previousMinimum + 1);
            const next = [Math.max(minimumWidth, node.size?.[0] || 0), shrink ? height : Math.max(height, node.size?.[1] || 0)];
            previousMinimum = height; exactFit = false;
            if (next[0] !== node.size?.[0] || next[1] !== node.size?.[1]) node.setSize?.(next);
            node.setDirtyCanvas?.(true, true);
        });
    }
    const observer = new ResizeObserver(() => fit()); observer.observe(container);
    widget.fit = fit;
    widget.refreshConnections = () => {if (disposed) return; renderList(); fit();};
    settingsButton.addEventListener('click', () => { settingsPanel.hidden = !settingsPanel.hidden; settingsButton.setAttribute('aria-expanded', String(!settingsPanel.hidden)); fit(); });
    visibleCount.addEventListener('change', () => {widget.state.maxVisibleImages = normalizeVisibleImages(visibleCount.value); visibleCount.value = String(widget.state.maxVisibleImages); saveState(node, widget.state); fit(true);});
    maxZoom.addEventListener('change',()=>{widget.state.maxZoomPercent=normalizeZoomLimit(maxZoom.value,widget.state.maxZoomPercent);maxZoom.value=String(widget.state.maxZoomPercent);saveState(node,widget.state);viewport.refresh();});
    function closeLightbox(restoreFocus = true) {
        aSelect.close(); bSelect.close();
        if (!lightbox) return;
        viewport.cancelGesture();
        const { overlay, previousFocus, previewMinHeight, stageMinHeight, toolbarWrap } = lightbox;
        document.removeEventListener("keydown", lightbox.onKeyDown, true);
        container.insertBefore(toolbar, list); container.insertBefore(settingsPanel, list); container.insertBefore(preview, list);
        preview.style.minHeight = previewMinHeight; stage.style.minHeight = stageMinHeight; toolbar.style.flexWrap = toolbarWrap;
        enlargeButton.style.display = "flex";
        overlay.remove(); lightbox = null;
        fit();
        viewport.refresh();
        if (activeCompareLightboxClose === closeLightbox) activeCompareLightboxClose = null;
        if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        node.setDirtyCanvas?.(true, true);
    }
    function openLightbox() {
        if (lightbox || enlargeButton.disabled) return;
        viewport.cancelGesture();
        const previousFocus = document.activeElement;
        activeCompareLightboxClose?.(false);
        const overlay = document.createElement("div");
        Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "2147483646", background: "rgba(0,0,0,.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", boxSizing: "border-box" });
        const panel = document.createElement("div");
        panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", tr("enlarge"));
        Object.assign(panel.style, { width: "100%", height: "100%", maxWidth: "1600px", maxHeight: "1200px", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--ruyi-border)", borderRadius: "9px", boxShadow: "0 16px 60px rgba(0,0,0,.6)", background: "var(--ruyi-group-bg)", color: "var(--ruyi-text)", font: "13px/1.25 system-ui, -apple-system, Segoe UI, sans-serif" });
        const header = document.createElement("div");
        Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "10px 12px", flex: "0 0 auto" });
        const title = document.createElement("span"); title.textContent = tr("enlarge");
        const closeButton = makeBtn(""); closeButton.title = tr("close"); closeButton.setAttribute("aria-label", tr("close"));
        closeButton.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        Object.assign(closeButton.style, { boxSizing:"border-box",width:"32px",height:"32px",padding:"0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:"0" });
        closeButton.addEventListener("click", () => closeLightbox());
        header.append(title, closeButton); panel.append(header, toolbar, settingsPanel, preview); overlay.appendChild(panel);
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && [aSelect,bSelect].some(control => control.getAttribute('aria-expanded') === 'true')) return;
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeLightbox(); return; }
            if (event.key !== "Tab") return;
            const controls = [closeButton, aSelect, bSelect, modeButton, settingsButton, ...(!settingsPanel.hidden ? [visibleCount,maxZoom] : []),viewport.reset,viewport.range].filter(control=>!control.disabled);
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        lightbox = { overlay, previousFocus, onKeyDown, previewMinHeight: preview.style.minHeight, stageMinHeight: stage.style.minHeight, toolbarWrap: toolbar.style.flexWrap };
        preview.style.minHeight = "0"; stage.style.minHeight = "0"; toolbar.style.flexWrap = "wrap";
        enlargeButton.style.display = "none";
        overlay.addEventListener("click", (event) => { event.stopPropagation(); if (event.target === overlay) closeLightbox(); });
        for (const type of ["pointerdown", "pointermove", "pointerup", "wheel", "keydown"]) overlay.addEventListener(type, (event) => event.stopPropagation());
        document.body.appendChild(overlay); document.addEventListener("keydown", onKeyDown, true);
        activeCompareLightboxClose = closeLightbox;
        viewport.refresh();
        closeButton.focus({ preventScroll: true });
    }

    const emptyOverlay = document.createElement("div");
    Object.assign(emptyOverlay.style, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", padding: "18px", textAlign: "center", pointerEvents: "none" });

    function clearFullCache() { for (const e of widget.fullCache.values()) { try { e.img.src = ""; } catch {} } widget.fullCache.clear(); }
    function loadFull(item) {
        if (!item) return Promise.resolve(null);
        const url = viewUrl(item.preview); if (!url) return Promise.resolve(null);
        const existing = widget.fullCache.get(url); if (existing) return existing.promise;
        const img = new Image(); img.decoding = "async";
        const entry = { img, promise: new Promise((resolve) => { img.onload = () => resolve(img); img.onerror = () => resolve(null); }) };
        widget.fullCache.set(url, entry); img.src = url; return entry.promise;
    }
    function pruneFullCache(keepItems) {
        const keep = new Set((keepItems || []).filter(Boolean).slice(0, MAX_FULL_CACHE).map((i) => viewUrl(i.preview)));
        for (const [url, entry] of [...widget.fullCache.entries()]) if (!keep.has(url)) { try { entry.img.src = ""; } catch {} widget.fullCache.delete(url); }
    }
    function makeStageImage(image) {
        const el = document.createElement("img"); if (image?.src) el.src = image.src;
        el.draggable=false;
        Object.assign(el.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block", pointerEvents: "none" });
        return el;
    }
    function makeCorner(text, side, color) {
        const el = document.createElement("div"); el.textContent = text;
        Object.assign(el.style, { position: "absolute", top: "8px", [side]: "8px", padding: "3px 7px", borderRadius: "4px", background: "rgba(0,0,0,.64)", border: `1px solid ${color}`, color: "#fff", maxWidth: "44%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "600", pointerEvents: "none", zIndex: "5" });
        el.title = text; return el;
    }

    function updateTopControls() {
        visibleCount.value = String(widget.state.maxVisibleImages);
        maxZoom.value=String(widget.state.maxZoomPercent);viewport.refresh();
        const counts = itemCounts(widget.items);
        const { a, b } = selectResolved(widget.items, widget.state);
        const refill = (select, currentKey, otherKey) => {
            select.setOptions(widget.items.map(item => ({value:item.key, label:displayLabel(item, counts, widget.state), disabled:widget.items.length > 1 && item.key === otherKey})));
            select.value = currentKey || '';
            select.disabled = !widget.items.length;
        };
        refill(aSelect, a?.key, b?.key);
        refill(bSelect, b?.key, a?.key);
        modeButton.textContent = widget.state.mode === "wipe" ? tr("wipe") : tr("toggle");
        stage.style.cursor = widget.state.mode === "wipe" ? "crosshair" : "pointer";
        aLabel.textContent = tr("selectA"); bLabel.textContent = tr("selectB");
    }

    async function triggerManualSave(item, button, rowStatus) {
        const counts = itemCounts(widget.items);
        const displayName = widget.state.displayNames[String(item.input)] || `#${item.input}`;
        const saveName = widget.state.saveNames[String(item.input)] || DEFAULT_SAVE_NAME_TEMPLATE;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.style.opacity = "0.55";
        button.style.cursor = "wait";
        try {
            const response = await api.fetchApi("/ruyi_nodes/image_compare/manual_save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: item.preview, input_no: item.input, frame_no: item.frame, frame_count: item.frame_count || counts.get(item.input) || 1, display_name: displayName, save_name: saveName, filename_template: DEFAULT_TEMPLATE }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.ok) throw new Error(data?.error || response.statusText || "save-failed");
            const savedText = `${tr("saved")}：${data.full_path || data.filename || tr("saved")}`;
            widget.savedStatus.set(item.key, { text: savedText, error: false });
            rowStatus.textContent = savedText; rowStatus.title = savedText; rowStatus.style.color = "#9ed0ff";
        } catch (e) {
            console.error("manual save failed", e);
            const failedText = `${tr("saveFailed")}：${saveLabel(item, counts, widget.state)}`;
            widget.savedStatus.set(item.key, { text: failedText, error: true });
            rowStatus.textContent = failedText; rowStatus.title = failedText; rowStatus.style.color = "#ffb3b3";
        } finally {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.style.opacity = "";
            button.style.cursor = "pointer";
        }
    }

    function renderList() {
        const scrollTop = list.scrollTop;
        list.replaceChildren();
        const rows = compareRows(node, widget.items);
        const counts = itemCounts(rows);
        for (const item of rows) {
            const row = document.createElement("div");
            row.dataset.compareRow = item.key; row.dataset.pending = String(!!item.pending);
            Object.assign(row.style, { flexShrink: '0', display: "grid", gridTemplateColumns: "110px 1fr", gap: "10px", alignItems: "start", padding: "8px", border: `1px solid ${item.key === widget.state.aKey ? "#f2b84b" : item.key === widget.state.bKey ? "#58a6ff" : "var(--ruyi-border)"}`, borderRadius: "6px", background: "var(--ruyi-content-bg)" });
            const thumbWrap = document.createElement("div"); Object.assign(thumbWrap.style, { position: "relative", width: "110px", height: "110px", background: "var(--ruyi-content-bg)", overflow: "hidden", borderRadius: "4px", border: "1px solid var(--ruyi-border)" });
            const thumb = document.createElement(item.pending ? 'div' : 'img');
            if (item.pending) {thumb.textContent = tr('waitingImage');Object.assign(thumb.style, {display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--ruyi-muted)'});}
            else {thumb.src = viewUrl(item.thumb); thumb.loading = "lazy"; thumb.decoding = "async";thumb.addEventListener("contextmenu", (event) => { event.preventDefault(); event.stopPropagation(); showOriginalImageContextMenu(item, event.clientX, event.clientY); });}
            Object.assign(thumb.style, { width: "100%", height: "100%", objectFit: "contain" });
            const badge = document.createElement("div"); badge.textContent = item.key === widget.state.aKey ? "A" : (item.key === widget.state.bKey ? "B" : ""); Object.assign(badge.style, { position: "absolute", top: "4px", right: "4px", minWidth: "18px", minHeight: "18px", padding: "1px 4px", borderRadius: "3px", textAlign: "center", background: item.key === widget.state.aKey ? "#9a6a12" : item.key === widget.state.bKey ? "#1f5f9f" : "transparent", color: "#fff", fontWeight: "700", fontSize: "10px", display: badge.textContent ? "block" : "none" });
            thumbWrap.append(thumb, badge);
            row.appendChild(thumbWrap);

            const body = document.createElement("div"); Object.assign(body.style, { display: "flex", flexDirection: "column", gap: "7px", minWidth: "0" });

            const displayRow = document.createElement("div"); Object.assign(displayRow.style, { display: "grid", gridTemplateColumns: "82px 1fr", gap: "8px", alignItems: "center" });
            const displayLabelEl = document.createElement("div"); displayLabelEl.textContent = `${tr("displayName")}：`;
            const displayInput = makeTextInput(); displayInput.value = widget.state.displayNames[String(item.input)] || ""; displayInput.placeholder = `#${item.input}`;
            displayRow.append(displayLabelEl, displayInput);

            const saveRow = document.createElement("div"); Object.assign(saveRow.style, { display: "grid", gridTemplateColumns: "82px 1fr", gap: "8px", alignItems: "center" });
            const saveLabelEl = document.createElement("div"); saveLabelEl.textContent = `${tr("saveName")}：`;
            const saveInput = makeTextInput(); saveInput.value = widget.state.saveNames[String(item.input)] || DEFAULT_SAVE_NAME_TEMPLATE; saveInput.title = tr("templateHelp"); saveInput.placeholder = DEFAULT_SAVE_NAME_TEMPLATE;
            saveRow.append(saveLabelEl, saveInput);

            const meta = document.createElement("div");
            Object.assign(meta.style, { display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap", color: "#aab1b8", fontSize: "11px" });
            const metaResolution = document.createElement("span");
            metaResolution.textContent = `${tr("resolution")}：${item.width} × ${item.height}`;
            const metaSize = document.createElement("span");
            metaSize.textContent = `${tr("fileSize")}：${formatBytes(item.size_bytes)}`;
            if (item.pending) meta.textContent = tr('waitingImage'); else meta.append(metaResolution, metaSize);

            const controls = document.createElement("div"); Object.assign(controls.style, { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" });
            const autoLabel = document.createElement("label"); Object.assign(autoLabel.style, { display: "inline-flex", gap: "6px", alignItems: "center", cursor: "pointer" });
            const autoBox = document.createElement("input"); autoBox.type = "checkbox"; autoBox.checked = !!widget.state.autoSaveKeys[item.key];
            const autoText = document.createElement("span"); autoText.textContent = tr("autoSave");
            autoLabel.append(autoBox, autoText);
            const saveBtn = makeBtn(tr("saveNow"));
            saveBtn.disabled = !!item.pending;
            if (item.pending) {saveBtn.style.opacity = '.45';saveBtn.style.cursor = 'default';}
            const rowStatus = document.createElement("span");
            const savedState = widget.savedStatus.get(item.key);
            rowStatus.textContent = savedState?.text || ""; rowStatus.title = savedState?.text || "";
            Object.assign(rowStatus.style, { flex: "1 1 180px", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: savedState?.error ? "#ffb3b3" : "#9ed0ff", fontSize: "11px" });
            controls.append(autoLabel, saveBtn, rowStatus);

            body.append(displayRow, saveRow, meta, controls); row.appendChild(body); list.appendChild(row);

            const commitDisplay = () => {
                widget.state.displayNames[String(item.input)] = String(displayInput.value || "").slice(0, MAX_LABEL_LENGTH);
                saveState(node, widget.state);
                updateTopControls();
                renderPreview();
            };
            const commitSave = () => {
                const next = String(saveInput.value || "").trim().slice(0, 256) || DEFAULT_SAVE_NAME_TEMPLATE;
                widget.state.saveNames[String(item.input)] = next;
                saveInput.value = next;
                saveState(node, widget.state);
            };
            displayInput.addEventListener("input", commitDisplay); displayInput.addEventListener("change", commitDisplay); displayInput.addEventListener("blur", commitDisplay);
            saveInput.addEventListener('input', () => {widget.state.saveNames[String(item.input)] = saveInput.value.slice(0, 256);saveState(node, widget.state);});
            saveInput.addEventListener("change", commitSave); saveInput.addEventListener("blur", commitSave);
            autoBox.addEventListener("change", () => { if (autoBox.checked) widget.state.autoSaveKeys[item.key] = true; else delete widget.state.autoSaveKeys[item.key]; saveState(node, widget.state); });
            saveBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); triggerManualSave(item, saveBtn, rowStatus); });
        }
        list.scrollTop = scrollTop;
        fit();
    }

    async function renderPreview() {
        viewport.loading();
        const generation = ++widget.renderGeneration; stage.replaceChildren();
        enlargeButton.disabled = true;
        const { a, b } = selectResolved(widget.items, widget.state); saveState(node, widget.state, false);
        if (!a) { closeLightbox(); emptyOverlay.textContent = tr("noImage"); stage.appendChild(emptyOverlay); pruneFullCache([]); viewport.setImages([]); return; }
        emptyOverlay.textContent = tr("loading"); stage.appendChild(emptyOverlay);
        const [aImg, bImg] = await Promise.all([loadFull(a), loadFull(b)]); if (generation !== widget.renderGeneration) return;
        pruneFullCache([a, b]); stage.replaceChildren(); if (!aImg && !bImg) { emptyOverlay.textContent = tr("noImage"); stage.appendChild(emptyOverlay); viewport.setImages([]); return; }
        enlargeButton.disabled = false;
        const counts = itemCounts(widget.items);
        if (widget.state.mode === "toggle") {
            const showA = widget.state.toggleSide !== "B" || !bImg; const chosen = showA ? (aImg || bImg) : (bImg || aImg);
            stage.appendChild(makeStageImage(chosen)); stage.appendChild(makeCorner((showA ? "A" : "B") + " · " + (showA ? displayLabel(a, counts, widget.state) : displayLabel(b, counts, widget.state)), "left", showA ? "#f2b84b" : "#58a6ff")); viewport.setImages([aImg,bImg]); return;
        }
        const bottom = makeStageImage(bImg || aImg),top = makeStageImage(aImg || bImg);
        const wipeLayer=document.createElement('div');wipeLayer.dataset.compareWipeLayer='';
        Object.assign(wipeLayer.style,{position:'absolute',inset:'0',clipPath:`inset(0 ${100-widget.split*100}% 0 0)`,pointerEvents:'none'});wipeLayer.append(top);stage.append(bottom,wipeLayer);
        const divider = document.createElement("div"); Object.assign(divider.style, { position: "absolute", top: 0, bottom: 0, left: `${widget.split * 100}%`, width: "14px", marginLeft: "-7px", pointerEvents: "none", zIndex: 4 }); divider.dataset.ruyiDivider = "1";
        const line=document.createElement('div');Object.assign(line.style,{position:'absolute',left:'6px',top:'0',bottom:'0',width:'2px',background:'rgba(255,255,255,.9)',boxShadow:'0 0 0 1px rgba(0,0,0,.35)',pointerEvents:'none'});divider.append(line);stage.appendChild(divider);
        stage.appendChild(makeCorner(`A · ${displayLabel(a, counts, widget.state)}`, "left", "#f2b84b"));
        stage.appendChild(makeCorner(`B · ${displayLabel(b, counts, widget.state)}`, "right", "#58a6ff"));
        viewport.setImages([aImg,bImg]);
    }
    function applyWipePosition(clientX) {
        if (widget.state.mode !== "wipe" || !widget.items.length) return;
        const rect = stage.getBoundingClientRect(); if (rect.width <= 1) return;
        widget.split = clamp((clientX - rect.left) / rect.width, 0, 1);
        const wipeLayer = stage.querySelector('[data-compare-wipe-layer]'); if (wipeLayer) wipeLayer.style.clipPath = `inset(0 ${100 - widget.split * 100}% 0 0)`;
        const divider = stage.querySelector('[data-ruyi-divider="1"]'); if (divider) divider.style.left = `${widget.split * 100}%`;
    }
    function refreshAll() { updateTopControls(); renderList(); renderPreview(); }

    aSelect.addEventListener("change", () => { widget.state.aKey = aSelect.value; if (widget.items.length > 1 && widget.state.aKey === widget.state.bKey) { const firstOther = widget.items.find((it) => it.key !== widget.state.aKey); widget.state.bKey = firstOther?.key || widget.state.bKey; } saveState(node, widget.state); refreshAll(); });
    bSelect.addEventListener("change", () => { widget.state.bKey = bSelect.value; if (widget.items.length > 1 && widget.state.bKey === widget.state.aKey) { const firstOther = widget.items.find((it) => it.key !== widget.state.bKey); widget.state.aKey = firstOther?.key || widget.state.aKey; } saveState(node, widget.state); refreshAll(); });
    modeButton.addEventListener("click", (e) => { e.preventDefault(); widget.state.mode = widget.state.mode === "wipe" ? "toggle" : "wipe"; saveState(node, widget.state); updateTopControls(); renderPreview(); });

    widget.setItems = (items, autosaved = [], { persist = true } = {}) => {
        clearFullCache();
        // The workflow history stays bounded, while the current execution and
        // unlimited row mode must not drop images at the persistence limit.
        const nextItems = normalizePersistedCompareItems(items, Number.POSITIVE_INFINITY);
        const nextContentIds = new Map(nextItems.map((item) => [item.key, item.content_id || null]));
        for (const [key, oldContentId] of widget.itemContentIds.entries()) {
            const newContentId = nextContentIds.get(key);
            if (newContentId == null || (oldContentId != null && newContentId !== oldContentId)) {
                widget.savedStatus.delete(key); // content changed or input disappeared
            }
        }
        widget.itemContentIds = nextContentIds;
        widget.items = nextItems;
        if (persist) persistCompareItems(node, nextItems);
        if (Array.isArray(autosaved)) {
            for (const saved of autosaved) {
                if (!saved?.key) continue;
                const text = `${tr("autoSaved")}：${saved.full_path || saved.filename || ""}`;
                widget.savedStatus.set(saved.key, { text, error: false });
            }
        }
        selectResolved(widget.items, widget.state); saveState(node, widget.state, false); refreshAll();
    };
    widget.restoreState = () => { widget.state = getState(node); selectResolved(widget.items, widget.state); syncManifestWidget(node, widget.state); refreshAll(); };
    widget.restoreAfterWorkflowSwitch = () => {
        widget.state = getState(node);
        const persisted = getPersistedCompareItems(node);
        if (!widget.items.length && persisted.length) {
            widget.setItems(persisted, [], { persist: false });
            return;
        }
        selectResolved(widget.items, widget.state);
        syncManifestWidget(node, widget.state);
        refreshAll();
    };
    widget.onRemoved = () => { disposed = true; observer.disconnect(); closeLightbox(false); viewport.dispose(); aSelect.dispose(); bSelect.dispose(); widget.renderGeneration++; clearFullCache(); };
    refreshAll(); syncManifestWidget(node, widget.state); return widget;
}

app.registerExtension({
    name: "RuYi.ImageCompare",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;
        const originalCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            originalCreated?.apply(this, arguments);
            this.properties ||= {}; this.properties[STATE_KEY] = { ...defaultState(), ...(this.properties[STATE_KEY] || {}) };
            hideManifestWidget(this);
            this.ruyiCompareItems = getPersistedCompareItems(this);
            this.ruyiCompareWidget = makeCompareWidget(this);
            if (this.ruyiCompareItems.length) this.ruyiCompareWidget?.setItems?.(this.ruyiCompareItems, [], { persist: false });
            const width = Math.max(Number(this.size?.[0]) || 0, 720); const height = Math.max(Number(this.size?.[1]) || 0, 790); this.setSize?.([width, height]); this.setDirtyCanvas?.(true, true);
        };
        const originalConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (data) { const result = originalConfigure?.apply(this, arguments); setTimeout(() => { hideManifestWidget(this); this.ruyiCompareWidget?.restoreAfterWorkflowSwitch?.(); }, 0); return result; };
        const originalConnections = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (...args) {const result = originalConnections?.apply(this, args);queueMicrotask(() => this.ruyiCompareWidget?.refreshConnections?.());return result;};
        const originalResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function (...args) {const result = originalResize?.apply(this, args);this.ruyiCompareWidget?.fit?.();return result;};
        const originalSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function (data) { originalSerialize?.apply(this, arguments); data.properties ||= {}; const state = this.ruyiCompareWidget?.state || getState(this); data.properties[STATE_KEY] = { ...state, displayNames: { ...state.displayNames }, saveNames: { ...state.saveNames }, autoSaveKeys: { ...state.autoSaveKeys } }; data.properties[LAST_ITEMS_KEY] = normalizePersistedCompareItems(this.ruyiCompareWidget?.items || this.ruyiCompareItems || []); syncManifestWidget(this, state); };
        const originalExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (data) { const payload = getRuYiExecutionPayload(data); originalExecuted?.call(this, withoutNativeImagePreview(data)); this.imgs = null; this.images = null; this.ruyiCompareItems = payload.compareItems; this.ruyiCompareWidget?.setItems?.(this.ruyiCompareItems, payload.autosaved); this.setDirtyCanvas?.(true, true); };
        const originalRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () { this.ruyiCompareWidget?.onRemoved?.(); originalRemoved?.apply(this, arguments); };
    },
    afterConfigureGraph() {
        requestAnimationFrame(() => {
            for (const node of app.graph?._nodes || []) {
                if (node?.comfyClass !== NODE_NAME && node?.type !== NODE_NAME) continue;
                node.ruyiCompareWidget?.restoreAfterWorkflowSwitch?.();
            }
        });
    },
});
