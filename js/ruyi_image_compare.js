import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "RuYiImageCompare";
const STATE_KEY = "ruyi_image_compare";
const SAVE_MANIFEST_WIDGET = "save_manifest";
const OUTPUT_SUBFOLDER = "RuYi-Compare";
const DEFAULT_TEMPLATE = "%save_name%";
const DEFAULT_SAVE_NAME_TEMPLATE = "%display_name-date:yyyy-MM-dd_HHmmss%";
const MAX_FULL_CACHE = 2;
const MAX_LABEL_LENGTH = 64;

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
    return { mode: "wipe", aKey: null, bKey: null, toggleSide: "A", displayNames: {}, saveNames: {}, autoSaveKeys: {}, filenameTemplate: DEFAULT_TEMPLATE };
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
    state.displayNames = normalizeMap(state.displayNames || state.inputNames);
    state.saveNames = normalizeMap(state.saveNames, 256);
    state.autoSaveKeys = normalizeAuto(state.autoSaveKeys);
    state.filenameTemplate = DEFAULT_TEMPLATE;
    node.properties[STATE_KEY] = state;
    return state;
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
    Object.assign(el.style, { height: "26px", padding: "0 10px", border: "1px solid var(--border-color, #4b4b4b)", borderRadius: "5px", background: "var(--comfy-input-bg, #262626)", color: "var(--input-text, #ddd)", font: "12px/1 system-ui, -apple-system, Segoe UI, sans-serif", cursor: "pointer" });
    return el;
}
function makeSelect() {
    const el = document.createElement("select");
    Object.assign(el.style, { height: "28px", minWidth: "170px", padding: "0 8px", border: "1px solid var(--border-color, #4b4b4b)", borderRadius: "5px", background: "var(--comfy-input-bg, #262626)", color: "var(--input-text, #ddd)", font: "12px/1 system-ui, -apple-system, Segoe UI, sans-serif" });
    return el;
}
function makeTextInput() {
    const el = document.createElement("input");
    el.type = "text";
    Object.assign(el.style, { height: "26px", minWidth: "0", width: "100%", padding: "0 8px", border: "1px solid var(--border-color, #4b4b4b)", borderRadius: "5px", background: "var(--comfy-input-bg, #262626)", color: "var(--input-text, #ddd)", font: "12px/1 system-ui, -apple-system, Segoe UI, sans-serif", boxSizing: "border-box" });
    return el;
}

function makeCompareWidget(node) {
    const container = document.createElement("div");
    Object.assign(container.style, { width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color, #444)", borderRadius: "6px", background: "var(--comfy-menu-bg, #181818)", color: "var(--input-text, #ddd)", font: "12px/1.25 system-ui, -apple-system, Segoe UI, sans-serif" });

    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, { display: "flex", gap: "8px", alignItems: "center", padding: "8px", borderBottom: "1px solid var(--border-color, #3d3d3d)", background: "var(--comfy-menu-secondary-bg, #202020)" });
    const aLabel = document.createElement("span"); aLabel.textContent = tr("selectA");
    const bLabel = document.createElement("span"); bLabel.textContent = tr("selectB");
    const aSelect = makeSelect();
    const bSelect = makeSelect();
    const modeButton = makeBtn(tr("wipe"));
    const spacer = document.createElement("div"); spacer.style.flex = "1 1 auto";
    toolbar.append(aLabel, aSelect, bLabel, bSelect, spacer, modeButton);
    container.appendChild(toolbar);

    const stage = document.createElement("div");
    stage.setAttribute("data-capture-wheel", "true");
    Object.assign(stage.style, { position: "relative", flex: "1 1 auto", minHeight: "240px", background: "#090909", overflow: "hidden", userSelect: "none", touchAction: "none", cursor: "crosshair" });
    container.appendChild(stage);

    const list = document.createElement("div");
    Object.assign(list.style, { flex: "0 0 286px", overflowY: "auto", overflowX: "hidden", padding: "8px", display: "flex", flexDirection: "column", gap: "8px", background: "var(--comfy-menu-secondary-bg, #202020)", borderTop: "1px solid var(--border-color, #3d3d3d)" });
    container.appendChild(list);

    const widget = node.addDOMWidget("ruyi_image_compare_widget", "ruyi_image_compare_widget", container, { hideOnZoom: false, canvasOnly: true, getMinHeight: () => 470, getMaxHeight: () => 5000 });
    widget.serialize = false; widget.parent = node; widget.items = []; widget.fullCache = new Map(); widget.renderGeneration = 0; widget.split = 0.5; widget.state = getState(node);
    widget.savedStatus = new Map();
    widget.itemContentIds = new Map();

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
        Object.assign(el.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block", pointerEvents: "none" });
        return el;
    }
    function makeCorner(text, side, color) {
        const el = document.createElement("div"); el.textContent = text;
        Object.assign(el.style, { position: "absolute", top: "8px", [side]: "8px", padding: "3px 7px", borderRadius: "4px", background: "rgba(0,0,0,.64)", border: `1px solid ${color}`, color: "#fff", maxWidth: "44%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "600", pointerEvents: "none", zIndex: "5" });
        el.title = text; return el;
    }

    function updateTopControls() {
        const counts = itemCounts(widget.items);
        const { a, b } = selectResolved(widget.items, widget.state);
        const refill = (select, currentKey, otherKey) => {
            const prev = currentKey;
            select.replaceChildren();
            for (const item of widget.items) {
                const opt = document.createElement("option");
                opt.value = item.key; opt.textContent = displayLabel(item, counts, widget.state); opt.disabled = widget.items.length > 1 && item.key === otherKey;
                if (item.key === prev) opt.selected = true;
                select.appendChild(opt);
            }
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
        list.replaceChildren();
        const counts = itemCounts(widget.items);
        for (const item of widget.items) {
            const row = document.createElement("div");
            Object.assign(row.style, { display: "grid", gridTemplateColumns: "110px 1fr", gap: "10px", alignItems: "start", padding: "8px", border: `1px solid ${item.key === widget.state.aKey ? "#f2b84b" : item.key === widget.state.bKey ? "#58a6ff" : "#4a4a4a"}`, borderRadius: "6px", background: "#161616" });
            const thumbWrap = document.createElement("div"); Object.assign(thumbWrap.style, { position: "relative", width: "110px", height: "110px", background: "#0c0c0c", overflow: "hidden", borderRadius: "4px", border: "1px solid #333" });
            const thumb = document.createElement("img"); thumb.src = viewUrl(item.thumb); thumb.loading = "lazy"; thumb.decoding = "async"; Object.assign(thumb.style, { width: "100%", height: "100%", objectFit: "contain", display: "block" });
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
            meta.append(metaResolution, metaSize);

            const controls = document.createElement("div"); Object.assign(controls.style, { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" });
            const autoLabel = document.createElement("label"); Object.assign(autoLabel.style, { display: "inline-flex", gap: "6px", alignItems: "center", cursor: "pointer" });
            const autoBox = document.createElement("input"); autoBox.type = "checkbox"; autoBox.checked = !!widget.state.autoSaveKeys[item.key];
            const autoText = document.createElement("span"); autoText.textContent = tr("autoSave");
            autoLabel.append(autoBox, autoText);
            const saveBtn = makeBtn(tr("saveNow"));
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
            displayInput.addEventListener("change", commitDisplay); displayInput.addEventListener("blur", commitDisplay);
            saveInput.addEventListener("change", commitSave); saveInput.addEventListener("blur", commitSave);
            autoBox.addEventListener("change", () => { if (autoBox.checked) widget.state.autoSaveKeys[item.key] = true; else delete widget.state.autoSaveKeys[item.key]; saveState(node, widget.state); });
            saveBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); triggerManualSave(item, saveBtn, rowStatus); });
        }
    }

    async function renderPreview() {
        const generation = ++widget.renderGeneration; stage.replaceChildren();
        const { a, b } = selectResolved(widget.items, widget.state); saveState(node, widget.state, false);
        if (!a) { emptyOverlay.textContent = tr("noImage"); stage.appendChild(emptyOverlay); pruneFullCache([]); return; }
        emptyOverlay.textContent = tr("loading"); stage.appendChild(emptyOverlay);
        const [aImg, bImg] = await Promise.all([loadFull(a), loadFull(b)]); if (generation !== widget.renderGeneration) return;
        pruneFullCache([a, b]); stage.replaceChildren(); if (!aImg && !bImg) { emptyOverlay.textContent = tr("noImage"); stage.appendChild(emptyOverlay); return; }
        const counts = itemCounts(widget.items);
        if (widget.state.mode === "toggle") {
            const showA = widget.state.toggleSide !== "B" || !bImg; const chosen = showA ? (aImg || bImg) : (bImg || aImg);
            stage.appendChild(makeStageImage(chosen)); stage.appendChild(makeCorner((showA ? "A" : "B") + " · " + (showA ? displayLabel(a, counts, widget.state) : displayLabel(b, counts, widget.state)), "left", showA ? "#f2b84b" : "#58a6ff")); return;
        }
        const bottom = makeStageImage(bImg || aImg); const top = makeStageImage(aImg || bImg); top.style.clipPath = `inset(0 ${100 - widget.split * 100}% 0 0)`; stage.append(bottom, top);
        const divider = document.createElement("div"); Object.assign(divider.style, { position: "absolute", top: 0, bottom: 0, left: `${widget.split * 100}%`, width: "2px", marginLeft: "-1px", background: "rgba(255,255,255,.9)", boxShadow: "0 0 0 1px rgba(0,0,0,.35)", pointerEvents: "none", zIndex: 4 }); divider.dataset.ruyiDivider = "1"; stage.appendChild(divider);
        stage.appendChild(makeCorner(`A · ${displayLabel(a, counts, widget.state)}`, "left", "#f2b84b"));
        stage.appendChild(makeCorner(`B · ${displayLabel(b, counts, widget.state)}`, "right", "#58a6ff"));
    }
    function applyWipePosition(clientX) {
        if (widget.state.mode !== "wipe" || !widget.items.length) return;
        const rect = stage.getBoundingClientRect(); if (rect.width <= 1) return;
        widget.split = clamp((clientX - rect.left) / rect.width, 0, 1);
        const topImage = stage.querySelectorAll("img")[1]; if (topImage) topImage.style.clipPath = `inset(0 ${100 - widget.split * 100}% 0 0)`;
        const divider = stage.querySelector('[data-ruyi-divider="1"]'); if (divider) divider.style.left = `${widget.split * 100}%`;
    }
    function refreshAll() { updateTopControls(); renderList(); renderPreview(); }

    stage.addEventListener("pointermove", (e) => { if (widget.state.mode === "wipe") applyWipePosition(e.clientX); });
    stage.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); if (widget.state.mode === "wipe") { applyWipePosition(e.clientX); return; } widget.state.toggleSide = widget.state.toggleSide === "A" ? "B" : "A"; saveState(node, widget.state); renderPreview(); });
    aSelect.addEventListener("change", () => { widget.state.aKey = aSelect.value; if (widget.items.length > 1 && widget.state.aKey === widget.state.bKey) { const firstOther = widget.items.find((it) => it.key !== widget.state.aKey); widget.state.bKey = firstOther?.key || widget.state.bKey; } saveState(node, widget.state); refreshAll(); });
    bSelect.addEventListener("change", () => { widget.state.bKey = bSelect.value; if (widget.items.length > 1 && widget.state.bKey === widget.state.aKey) { const firstOther = widget.items.find((it) => it.key !== widget.state.bKey); widget.state.aKey = firstOther?.key || widget.state.aKey; } saveState(node, widget.state); refreshAll(); });
    modeButton.addEventListener("click", (e) => { e.preventDefault(); widget.state.mode = widget.state.mode === "wipe" ? "toggle" : "wipe"; saveState(node, widget.state); updateTopControls(); renderPreview(); });

    widget.setItems = (items, autosaved = []) => {
        clearFullCache();
        const nextItems = Array.isArray(items) ? items.filter((it) => it?.key) : [];
        const nextContentIds = new Map(nextItems.map((item) => [item.key, item.content_id || null]));
        for (const [key, oldContentId] of widget.itemContentIds.entries()) {
            const newContentId = nextContentIds.get(key);
            if (newContentId == null || (oldContentId != null && newContentId !== oldContentId)) {
                widget.savedStatus.delete(key); // content changed or input disappeared
            }
        }
        widget.itemContentIds = nextContentIds;
        widget.items = nextItems;
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
    widget.onRemoved = () => { clearFullCache(); };
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
            hideManifestWidget(this); this.ruyiCompareItems = []; this.ruyiCompareWidget = makeCompareWidget(this);
            const width = Math.max(Number(this.size?.[0]) || 0, 720); const height = Math.max(Number(this.size?.[1]) || 0, 790); this.setSize?.([width, height]); this.setDirtyCanvas?.(true, true);
        };
        const originalConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (data) { const result = originalConfigure?.apply(this, arguments); setTimeout(() => { hideManifestWidget(this); this.ruyiCompareWidget?.restoreState?.(); }, 0); return result; };
        const originalSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function (data) { originalSerialize?.apply(this, arguments); data.properties ||= {}; const state = this.ruyiCompareWidget?.state || getState(this); data.properties[STATE_KEY] = { ...state, displayNames: { ...state.displayNames }, saveNames: { ...state.saveNames }, autoSaveKeys: { ...state.autoSaveKeys } }; syncManifestWidget(this, state); };
        const originalExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (data) { originalExecuted?.apply(this, arguments); this.imgs = null; this.ruyiCompareItems = Array.isArray(data?.compare_items) ? data.compare_items : []; this.ruyiCompareWidget?.setItems?.(this.ruyiCompareItems, Array.isArray(data?.autosaved) ? data.autosaved : []); this.setDirtyCanvas?.(true, true); };
        const originalRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () { this.ruyiCompareWidget?.onRemoved?.(); originalRemoved?.apply(this, arguments); };
    },
});
