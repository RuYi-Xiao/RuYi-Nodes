import {app} from '../../scripts/app.js';
import './theme.mjs';
import {alignDimension, scaleDimensions} from './latent/dimensions.mjs';

const PRESETS_KEY = 'RuYi.EmptyLatent.Presets.v1';
const PRESETS_EVENT = 'ruyi-latent-presets-changed';
const labels = {
    zh: {swap:'交换宽高', presets:'分辨率预设', choose:'选择预设…', save:'保存预设', load:'读取', remove:'删除',
        scale:'等比缩放', percent:'缩放百分比', baseline:'以当前为基准', base:'基准', ratio:'宽高比', linked:'宽高已接入连线，请在上游调整分辨率。',
        rounding:'缩放后按对齐倍数取整，宽高比可能略有偏差。', invalid:'请输入有效的缩放百分比。', storage:'预设无法保存，请检查本地存储空间。'},
    en: {swap:'Swap width / height', presets:'Resolution preset', choose:'Select a preset…', save:'Save preset', load:'Load', remove:'Delete',
        scale:'Proportional scale', percent:'Scale percentage', baseline:'Use current as base', base:'Base', ratio:'Aspect ratio', linked:'Width or height is linked. Adjust resolution upstream.',
        rounding:'Dimensions are rounded to the alignment; the ratio may vary slightly.', invalid:'Enter a valid scale percentage.', storage:'Could not save presets. Check local storage space.'},
};
let stylesInstalled = false;

function installStyles() {
    if (stylesInstalled) return;
    stylesInstalled = true;
    const style = document.createElement('style');
    style.textContent = `
    .ruyi-latent-panel {box-sizing:border-box;height:auto!important;padding:10px;display:flex;flex-direction:column;gap:10px;background:var(--ruyi-group-bg);color:var(--ruyi-text);font:13px/1.4 system-ui;overflow:auto;min-width:0;}
    .ruyi-latent-panel * {box-sizing:border-box;}
    .ruyi-latent-panel .row {display:flex;align-items:center;flex-wrap:wrap;gap:7px;min-width:0;}
    .ruyi-latent-panel button,.ruyi-latent-panel input {font:inherit;color:inherit;background:var(--ruyi-control-bg);border:1px solid var(--ruyi-border);border-radius:5px;min-height:30px;padding:4px 8px;}
    .ruyi-latent-panel button {cursor:pointer;white-space:nowrap;}
    .ruyi-latent-panel button:hover:not(:disabled) {background:var(--ruyi-hover-bg);}
    .ruyi-latent-panel :disabled {opacity:.45;cursor:default;}
    .ruyi-latent-panel .preset-field {display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:center;gap:10px;}
    .ruyi-latent-panel .presets {width:100%;min-width:0;display:flex;align-items:center;justify-content:space-between;text-align:left;gap:8px;}
    .ruyi-latent-panel .presets::after {content:'';width:7px;height:7px;border:solid currentColor;border-width:0 1px 1px 0;transform:translateY(-2px) rotate(45deg);flex-shrink:0;}
    .ruyi-latent-panel .group {border-top:1px solid var(--ruyi-border);padding-top:10px;display:flex;flex-direction:column;gap:7px;}
    .ruyi-latent-panel .number {display:inline-flex;border:1px solid var(--ruyi-border);border-radius:5px;overflow:hidden;background:var(--ruyi-control-bg);}
    .ruyi-latent-panel .number input {border:0;border-radius:0;text-align:center;width:64px;appearance:textfield;}
    .ruyi-latent-panel .number input::-webkit-inner-spin-button {appearance:none;}
    .ruyi-latent-panel .number button {border:0;border-radius:0;padding:4px 6px;width:25px;font-size:12px;background:transparent;}
    .ruyi-latent-panel .muted {color:var(--ruyi-muted);font-size:12px;overflow-wrap:anywhere;}
    .ruyi-latent-panel .add {color:#83ce8d;font-weight:bold;}
    .ruyi-latent-panel .danger {color:#f2b0b0;}
    .ruyi-latent-presets-menu {position:fixed;z-index:10000;box-sizing:border-box;overflow:auto;background:var(--ruyi-control-bg);color:var(--ruyi-text);border:1px solid var(--ruyi-border);border-radius:5px;font-family:system-ui;line-height:1.4;padding:4px 0;}
    .ruyi-latent-presets-menu button {display:block;box-sizing:border-box;width:100%;border:0;border-radius:0;background:transparent;color:inherit;font:inherit !important;text-align:left;padding:var(--preset-padding);cursor:pointer;}
    .ruyi-latent-presets-menu button:hover,.ruyi-latent-presets-menu button:focus-visible {background:var(--ruyi-hover-bg);}
    .ruyi-latent-presets-menu button[aria-selected=true] {background:#505050;}
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
    const summary = element('div'); summary.style.fontWeight='bold';
    const first = element('div','row');first.append(swap,summary);root.append(first);
    const presetGroup=element('div','group');const presetLabel=element('label','preset-field');presetLabel.textContent=text.presets;
    const presets=button(text.choose,openPresets);presets.className='presets';presets.dataset.value='';
    presets.setAttribute('aria-label',text.presets);presets.setAttribute('aria-haspopup','listbox');presets.setAttribute('aria-expanded','false');presetLabel.append(presets);
    let presetMenu=null;
    const presetKey=p=>`${p.width}x${p.height}`;
    function closePresets(){
        presetMenu?.remove();presetMenu=null;presets.setAttribute('aria-expanded','false');
        document.removeEventListener('pointerdown',onPresetPointer,true);
        window.removeEventListener('resize',closePresets);window.removeEventListener('scroll',onPresetScroll,true);
    }
    function onPresetPointer(event){if(!presetMenu?.contains(event.target)&&!presets.contains(event.target))closePresets();}
    function onPresetScroll(event){if(!presetMenu?.contains(event.target))closePresets();}
    function openPresets(){
        if(presetMenu){closePresets();return;}
        const rect=presets.getBoundingClientRect();const scale=rect.width/presets.offsetWidth;
        presetMenu=element('div','ruyi-latent-presets-menu');presetMenu.setAttribute('role','listbox');presetMenu.setAttribute('aria-label',text.presets);
        presetMenu.style.width=`${rect.width}px`;presetMenu.style.fontSize=`${parseFloat(getComputedStyle(presets).fontSize)*scale}px`;
        presetMenu.style.setProperty('--preset-padding',`${5*scale}px ${8*scale}px`);
        presetMenu.style.maxHeight=`${Math.min(280*scale,window.innerHeight-16)}px`;
        for(const item of [null,...readPresets()]){
            const value=item?presetKey(item):'';
            const option=button(item?`${item.width} × ${item.height}`:text.choose,()=>{
                presets.dataset.value=value;refreshPresets();presets.focus();
            });
            option.dataset.value=value;option.setAttribute('role','option');option.setAttribute('aria-selected',String(value===presets.dataset.value));
            presetMenu.append(option);
        }
        presetMenu.onkeydown=event=>{
            const options=[...presetMenu.children];const index=options.indexOf(document.activeElement);
            if(event.key==='Escape'){event.preventDefault();closePresets();presets.focus();}
            else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
                event.preventDefault();options[event.key==='Home'?0:event.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1)))].focus();
            }else if(event.key==='Tab')closePresets();
            event.stopPropagation();
        };
        document.body.append(presetMenu);
        presetMenu.style.left=`${Math.max(0,Math.min(rect.left,window.innerWidth-rect.width))}px`;
        const menuHeight=presetMenu.getBoundingClientRect().height;
        presetMenu.style.top=`${rect.bottom+menuHeight>window.innerHeight?Math.max(0,rect.top-menuHeight):rect.bottom}px`;
        presets.setAttribute('aria-expanded','true');
        document.addEventListener('pointerdown',onPresetPointer,true);window.addEventListener('resize',closePresets);window.addEventListener('scroll',onPresetScroll,true);
        presetMenu.querySelector('[aria-selected=true]').focus();
    }
    const save=button(text.save,()=>{
        const items=readPresets();const preset={width:width.value,height:height.value};
        if(!items.some(p=>p.width===preset.width&&p.height===preset.height))items.push(preset);
        if(writePresets(items)){presets.dataset.value=presetKey(preset);refreshPresets();}
    });
    const plus=element('span','add');plus.textContent='✚';plus.setAttribute('aria-hidden','true');save.prepend(plus,' ');
    const load=button(text.load,()=>{
        const preset=readPresets().find(p=>presetKey(p)===presets.dataset.value);if(!preset)return;
        width.value=alignDimension(preset.width,alignment.value);height.value=alignDimension(preset.height,alignment.value);rebase();changed();
    });
    const remove=button(`❌ ${text.remove}`,()=>{
        writePresets(readPresets().filter(p=>presetKey(p)!==presets.dataset.value));
    },true);
    const presetRow=element('div','row');presetRow.append(save,load,remove);presetGroup.append(presetLabel,presetRow);root.append(presetGroup);
    const scaleGroup=element('div','group');const scaleRow=element('div','row');const scaleLabel=element('span');scaleLabel.textContent=text.scale;
    const number=element('span','number');const percent=element('input');percent.type='number';percent.min='1';percent.max='1600';percent.step='1';percent.value='100';percent.setAttribute('aria-label',text.percent);
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
    number.append(left,percent,right);scaleLabel.append(' ',number,' %');scaleRow.append(scaleLabel);
    const baseline=button(text.baseline,()=>{rebase();changed();});scaleRow.append(baseline);
    const scaleInfo=element('div','muted');const rounding=element('div','muted');rounding.textContent=text.rounding;
    scaleGroup.append(scaleRow,scaleInfo,rounding);root.append(scaleGroup);
    function linked() { return node.inputs?.some(input => ['width','height'].includes(input.name) && input.link != null); }
    function updateButtons() {
        const blocked=linked();const selected=!!presets.dataset.value;
        for(const el of [swap,presets,save,load,left,right,percent,baseline])el.disabled=blocked;
        load.disabled ||= !selected;remove.disabled=!selected;
        root.title=blocked?text.linked:'';if(blocked)closePresets();
    }
    function refreshPresets() {
        closePresets();const selected=readPresets().find(p=>presetKey(p)===presets.dataset.value);
        presets.dataset.value=selected?presetKey(selected):'';presets.textContent=selected?`${selected.width} × ${selected.height}`:text.choose;updateButtons();
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
    widget.onRemove=function(...args){disposed=true;observer.disconnect();closePresets();window.removeEventListener(PRESETS_EVENT,refreshPresets);window.removeEventListener('storage',storageChanged);onRemove?.apply(this,args);};
    snap();refreshPresets();fit(true);
}

app.registerExtension({
    name:'RuYi-Nodes.EmptyLatent',
    nodeCreated(node){
        if(node.comfyClass!=='RuYiEmptyLatentImage'&&node.type!=='RuYiEmptyLatentImage')return;
        makeControls(node);
    },
});
