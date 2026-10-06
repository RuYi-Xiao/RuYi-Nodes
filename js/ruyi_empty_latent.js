import {app} from '../../scripts/app.js';
import './theme.mjs';
import {alignDimension, scaleDimensions} from './latent/dimensions.mjs';
import {createDropdown} from './dropdown.mjs';

const PRESETS_KEY = 'RuYi.EmptyLatent.Presets.v1';
const PRESETS_EVENT = 'ruyi-latent-presets-changed';
const labels = {
    zh: {current:'当前分辨率',swap:'交换宽高', presets:'分辨率预设', choose:'选择预设…', save:'保存预设', load:'读取', remove:'删除',
        scale:'等比缩放', percent:'缩放百分比', baseline:'设为基准', base:'基准', ratio:'宽高比', linked:'宽高已接入连线，请在上游调整分辨率。',
        rounding:'缩放后按对齐倍数取整，宽高比可能略有偏差。', invalid:'请输入有效的缩放百分比。', storage:'预设无法保存，请检查本地存储空间。'},
    en: {current:'Resolution',swap:'Swap W / H', presets:'Resolution preset', choose:'Select a preset…', save:'Save preset', load:'Load', remove:'Delete',
        scale:'Scale', percent:'Scale percentage', baseline:'Set base', base:'Base', ratio:'Aspect ratio', linked:'Width or height is linked. Adjust resolution upstream.',
        rounding:'Dimensions are rounded to the alignment; the ratio may vary slightly.', invalid:'Enter a valid scale percentage.', storage:'Could not save presets. Check local storage space.'},
};
let stylesInstalled = false;

function installStyles() {
    if (stylesInstalled) return;
    stylesInstalled = true;
    const style = document.createElement('style');
    style.textContent = `
    .ruyi-latent-panel {box-sizing:border-box;height:auto!important;padding:10px;display:flex;flex-direction:column;gap:10px;background:transparent;color:var(--ruyi-text);font:13px/1.4 system-ui;overflow:auto;min-width:0;}
    .ruyi-latent-panel * {box-sizing:border-box;}
    .ruyi-latent-panel .aligned-row {display:grid;grid-template-columns:84px minmax(0,1fr) 104px;align-items:center;gap:8px;min-width:0;}
    .ruyi-latent-panel .field-label {width:84px;line-height:1.25;}
    .ruyi-latent-panel button,.ruyi-latent-panel input {font:inherit;color:inherit;background:var(--ruyi-control-bg);border:1px solid var(--ruyi-border);border-radius:5px;height:28px;min-height:28px;padding:4px 8px;}
    .ruyi-latent-panel button {cursor:pointer;white-space:nowrap;}
    .ruyi-latent-panel button:hover:not(:disabled) {background:var(--ruyi-hover-bg);}
    .ruyi-latent-panel :disabled {opacity:.45;cursor:default;}
    .ruyi-latent-panel .preset-field .presets {grid-column:2 / 4;width:100%;}
    .ruyi-latent-panel .preset-actions {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
    .ruyi-latent-panel .summary {font-weight:600;text-align:center;white-space:nowrap;}
    .ruyi-latent-panel .group {border-top:1px solid var(--ruyi-border);padding-top:10px;display:flex;flex-direction:column;gap:7px;}
    .ruyi-latent-panel .scale-value {display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;}
    .ruyi-latent-panel .number {display:inline-flex;min-width:0;height:28px;border:1px solid var(--ruyi-border);border-radius:5px;overflow:hidden;background:var(--ruyi-control-bg);}
    .ruyi-latent-panel .number input {border:0;border-radius:0;text-align:center;width:44px;min-width:0;height:26px;min-height:26px;padding:0;appearance:textfield;}
    .ruyi-latent-panel .number input::-webkit-inner-spin-button {appearance:none;}
    .ruyi-latent-panel .number button {border:0;border-radius:0;padding:0;width:20px;height:26px;min-height:26px;flex:0 0 20px;font-size:11px;background:transparent;}
    .ruyi-latent-panel .muted {color:var(--ruyi-muted);font-size:12px;overflow-wrap:anywhere;}
    .ruyi-latent-panel .add {color:#83ce8d;font-weight:bold;}
    .ruyi-latent-panel .danger {color:#f2b0b0;}
    `;
    document.head.append(style);
}

function readPresets() {
    try {
        const items = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
        const unique = new Map();
        if(Array.isArray(items))for(const p of items){
            if(p && Number.isInteger(p.width) && Number.isInteger(p.height)
                && p.width >= 16 && p.width <= 16384 && p.height >= 16 && p.height <= 16384){
                unique.set(`${p.width}x${p.height}`,{width:p.width,height:p.height});
            }
        }
        return [...unique.values()];
    } catch { return []; }
}

function makeControls(node) {
    installStyles();
    const lang = app.extensionManager?.setting?.get('Comfy.Locale') || document.documentElement.lang || navigator.language;
    const text = labels[String(lang).toLowerCase().startsWith('zh') ? 'zh' : 'en'];
    const width = node.widgets.find(w => w.name === 'width');
    const height = node.widgets.find(w => w.name === 'height');
    const alignment = node.widgets.find(w => w.name === 'alignment');
    node.properties ||= {};
    const storedBase = node.properties.ruyi_latent_scale;
    let base = {width:width.value, height:height.value, percent:100};
    const root = document.createElement('div'); root.className = 'ruyi-latent-panel';
    root.addEventListener('pointerdown',event=>event.stopPropagation());
    root.addEventListener('keydown',event=>event.stopPropagation());
    function element(tag, className = '') { const el=document.createElement(tag); el.className=className; return el; }
    function button(label, action, danger = false) { const el=element('button',danger?'danger':''); el.type='button'; el.textContent=label; el.onclick=action; return el; }
    const swap = button(`⇄ ${text.swap}`, () => {
        [width.value, height.value] = [height.value, width.value];
        [base.width, base.height] = [base.height, base.width];
        changed();
    });
    const summary = element('div','summary');
    const currentLabel=element('span','field-label');currentLabel.textContent=text.current;
    const first = element('div','aligned-row');first.append(currentLabel,summary,swap);root.append(first);
    const presetGroup=element('div','group');const presetLabel=element('div','aligned-row preset-field');
    const presetCaption=element('span','field-label');presetCaption.textContent=text===labels.en?'Presets':text.presets;
    const presets=createDropdown({label:text.presets,className:'presets'});presetLabel.append(presetCaption,presets);
    const closePresets=()=>presets.close();
    const presetKey=p=>`${p.width}x${p.height}`;
    presets.addEventListener('change',updateButtons);
    const save=button(text.save,()=>{
        const items=readPresets();const preset={width:width.value,height:height.value};
        if(!items.some(p=>p.width===preset.width&&p.height===preset.height))items.push(preset);
        if(writePresets(items)){presets.value=presetKey(preset);refreshPresets();}
    });
    const plus=element('span','add');plus.textContent='✚';plus.setAttribute('aria-hidden','true');save.prepend(plus,' ');
    const load=button(text.load,()=>{
        const preset=readPresets().find(p=>presetKey(p)===presets.dataset.value);if(!preset)return;
        width.value=alignDimension(preset.width,alignment.value);height.value=alignDimension(preset.height,alignment.value);rebase();changed();
    });
    const remove=button(`❌ ${text.remove}`,()=>{
        writePresets(readPresets().filter(p=>presetKey(p)!==presets.dataset.value));
    },true);
    const presetRow=element('div','preset-actions');presetRow.append(save,load,remove);presetGroup.append(presetLabel,presetRow);root.append(presetGroup);
    const scaleGroup=element('div','group');const scaleRow=element('div','aligned-row');const scaleLabel=element('span','field-label');scaleLabel.textContent=text.scale;
    const number=element('span','number');const percent=element('input');percent.type='number';percent.min='1';percent.max='1600';percent.step='1';percent.value='100';percent.setAttribute('aria-label',text.percent);
    percent.title=text.rounding;
    function applyScale(event) {
        const value=Number(percent.value);
        if(!Number.isFinite(value)||value<1||value>1600){
            if(event?.type!=='input'){percent.value=String(base.percent);percent.setCustomValidity(text.invalid);percent.reportValidity();}
            return;
        }
        percent.setCustomValidity('');[width.value,height.value]=scaleDimensions(base.width,base.height,value,alignment.value);base.percent=value;changed();
    }
    percent.oninput=applyScale;
    percent.onchange=applyScale;
    const left=button('◀',()=>{percent.value=String(Math.max(1,base.percent-10));applyScale();});left.title='−10%';
    const right=button('▶',()=>{percent.value=String(Math.min(1600,base.percent+10));applyScale();});right.title='+10%';
    number.append(left,percent,right);const scaleValue=element('div','scale-value');scaleValue.append(number,' %');scaleRow.append(scaleLabel,scaleValue);
    const baseline=button(text.baseline,()=>{rebase();changed();});scaleRow.append(baseline);
    const scaleInfo=element('div','muted');
    scaleGroup.append(scaleRow,scaleInfo);root.append(scaleGroup);
    function linked() { return node.inputs?.some(input => ['width','height'].includes(input.name) && input.link != null); }
    function updateButtons() {
        const blocked=linked();const selected=!!presets.dataset.value;
        for(const el of [swap,presets,save,load,left,right,percent,baseline])el.disabled=blocked;
        load.disabled ||= !selected;remove.disabled=!selected;
        root.title=blocked?text.linked:'';if(blocked)closePresets();
    }
    function refreshPresets() {
        closePresets();const selected=readPresets().find(p=>presetKey(p)===presets.dataset.value);
        presets.setOptions([{value:'',label:text.choose},...readPresets().map(p=>({value:presetKey(p),label:`${p.width} × ${p.height}`}))]);
        presets.value=selected?presetKey(selected):'';updateButtons();
    }
    function writePresets(items) {
        try {localStorage.setItem(PRESETS_KEY,JSON.stringify(items));}
        catch {alert(text.storage);return false;}
        window.dispatchEvent(new Event(PRESETS_EVENT));return true;
    }
    function rebase() {base={width:width.value,height:height.value,percent:100};percent.value='100';}
    function changed() {
        node.properties.ruyi_latent_scale={...base};
        summary.textContent=`${width.value} × ${height.value}`;
        scaleInfo.textContent=`${text.base}: ${base.width} × ${base.height} · ${text.ratio}: ${(width.value/height.value).toFixed(3)} : 1`;
        node.setDirtyCanvas?.(true,true);
    }
    function snap() {
        if(!linked()){width.value=alignDimension(width.value,alignment.value);height.value=alignDimension(height.value,alignment.value);}
        for(const dimension of [width,height]){
            dimension.options.step=Number(alignment.value)*10;
            dimension.options.step2=Number(alignment.value);
        }
        rebase();changed();updateButtons();
    }
    for(const w of [width,height,alignment]){
        const callback=w.callback;
        w.callback=function(...args){callback?.apply(this,args);snap();};
    }
    const configure=node.onConfigure;
    node.onConfigure=function(...args){
        const restored=args[0]?.properties?.ruyi_latent_scale || storedBase;
        configure?.apply(this,args);snap();
        if(restored&&Number.isFinite(restored.width)&&Number.isFinite(restored.height)&&Number.isFinite(restored.percent)
            &&restored.width>=16&&restored.height>=16&&restored.percent>=1&&restored.percent<=1600){
            const expected=scaleDimensions(restored.width,restored.height,restored.percent,alignment.value);
            if(expected[0]===width.value&&expected[1]===height.value){base={...restored};percent.value=String(base.percent);changed();}
        }
        fit(true);
    };
    const connections=node.onConnectionsChange;
    node.onConnectionsChange=function(...args){connections?.apply(this,args);updateButtons();};
    const storageChanged=event=>{if(event.key===PRESETS_KEY)refreshPresets();};
    window.addEventListener(PRESETS_EVENT,refreshPresets);window.addEventListener('storage',storageChanged);
    const controlsHeight=()=>root.scrollHeight+12;
    const widget=node.addDOMWidget('ruyi_latent_controls','ruyi_latent_controls',root,{serialize:false,hideOnZoom:false,canvasOnly:true,getMinHeight:controlsHeight,getHeight:controlsHeight});
    widget.serialize=false;
    widget.computeSize=width=>[Math.max(380,width),controlsHeight()];
    let queued=false,disposed=false,exactFit=false;
    function fit(exact=false){
        exactFit ||= exact;
        if(queued||disposed)return;queued=true;
        requestAnimationFrame(()=>{
            queued=false;if(disposed||!root.isConnected)return;
            const height=node.computeSize?.()[1] || controlsHeight()+170;
            node.min_size=[380,height];
            node.setSize([Math.max(380,node.size[0]),exactFit?height:Math.max(height,node.size[1])]);
            exactFit=false;node.setDirtyCanvas?.(true,true);
        });
    }
    const observer=new ResizeObserver(()=>fit());observer.observe(root);
    const onRemove=widget.onRemove;
    widget.onRemove=function(...args){disposed=true;observer.disconnect();presets.dispose();window.removeEventListener(PRESETS_EVENT,refreshPresets);window.removeEventListener('storage',storageChanged);onRemove?.apply(this,args);};
    snap();refreshPresets();fit(true);
}

app.registerExtension({
    name:'RuYi-Nodes.EmptyLatent',
    nodeCreated(node){
        if(node.comfyClass!=='RuYiEmptyLatentImage'&&node.type!=='RuYiEmptyLatentImage')return;
        makeControls(node);
    },
});
