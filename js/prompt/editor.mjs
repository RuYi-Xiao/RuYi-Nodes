import {insertion, rebaseSpelling, matchedAlias} from './engine.mjs';
import '../theme.mjs';

let worker, requestId = 0;
const pending = new Map();
function request(command, args = {}) {
    if (!worker) {
        worker = new Worker(new URL('./worker.mjs', import.meta.url), {type:'module'});
        worker.onmessage = ({data}) => {
            const entry = pending.get(data.id); if (!entry) return;
            pending.delete(data.id); data.error ? entry.reject(Error(data.error)) : entry.resolve(data.result);
        };
        worker.onerror = event => {
            for (const entry of pending.values()) entry.reject(Error(event.message || 'Worker unavailable'));
            pending.clear(); worker.terminate(); worker = null;
        };
    }
    const id = ++requestId;
    return new Promise((resolve,reject) => {pending.set(id,{resolve,reject});worker.postMessage({id,command,args});});
}

const labels = {
    zh:{positive:'正面提示词',negative:'负面提示词',global:'全局',add:'添加段落',alias:'别名',search:'搜索提示词…',settings:'设置',
        completion:'标签联想',spelling:'拼写检查',underscore:'插入时保留下划线',local:'本地导出词表',danbooru:'Danbooru 近期词表',
        imported:'导入词表',import:'导入 CSV',words:'自定义词（逗号分隔）',loading:'正在加载本地词库…',ready:'本地词库已就绪',
        unavailable:'词库/拼写检查不可用',fontSize:'提示词字号',fontDecrease:'减小字号',fontIncrease:'增大字号',onOff:'开/关',spellingErrors:'拼写错误：',ignore:'忽略本次',learn:'加入自定义词典',up:'上移',down:'下移',delete:'删除',
        enable:'启用段落',collapse:'折叠段落',expand:'展开段落',next:'下一处',previous:'上一处',word:'拼写提示',noSuggestions:'没有修正建议',
        importSession:'已导入（保存在当前浏览器）',invalid:'工作流提示词数据无效',section:'段落',locate:'定位单词',negativeEnabled:'启用负面提示词',resize:'调整段落高度',scrollbar:'段落滚动条',searchHits:'搜索命中',tagHits:'词库标签命中',tagHelp:'按完整标签、别名或译名匹配，重复项分别计数'},
    en:{positive:'Positive prompt',negative:'Negative prompt',global:'Global',add:'Add section',alias:'Alias',search:'Search prompts…',settings:'Settings',
        completion:'Tag completion',spelling:'Spell check',underscore:'Keep underscores on insertion',local:'Local exported tags',danbooru:'Recent Danbooru tags',
        imported:'Imported tags',import:'Import CSV',words:'Custom words (comma separated)',loading:'Loading local vocabulary…',ready:'Local vocabulary ready',
        unavailable:'Vocabulary/spelling unavailable',fontSize:'Prompt font size',fontDecrease:'Decrease font size',fontIncrease:'Increase font size',onOff:'On/off',spellingErrors:'Spelling errors:',ignore:'Ignore once',learn:'Add to custom dictionary',up:'Move up',down:'Move down',delete:'Delete',
        enable:'Enable section',collapse:'Collapse section',expand:'Expand section',next:'Next match',previous:'Previous match',word:'Spelling suggestions',
        noSuggestions:'No suggestions',importSession:'Imported (saved in this browser)',invalid:'Invalid workflow prompt data',section:'Section',locate:'Locate word',negativeEnabled:'Enable negative prompts',resize:'Resize paragraph',scrollbar:'Paragraph scrollbar',searchHits:'Search matches',tagHits:'Vocabulary tag matches',tagHelp:'Exact tags, aliases or translations; repeated occurrences count separately'}
};

const el = (tag, className = '', text) => {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = text; return element;
};
function installStyles() {
    if (document.getElementById('ruyi-prompt-style')) return;
    const style = el('style'); style.id = 'ruyi-prompt-style';
    style.textContent = `
    .ruyi-prompt {box-sizing:border-box;width:100%;height:auto!important;padding:10px;color:var(--ruyi-text);font:13px Arial,sans-serif;background:var(--ruyi-group-bg);border-radius:6px;}
    .ruyi-prompt * {box-sizing:border-box;} .ruyi-prompt [hidden] {display:none!important;}
    .ruyi-prompt button,.ruyi-prompt input[type=text] {font:inherit;color:inherit;background:var(--ruyi-control-bg);border:1px solid var(--ruyi-border);border-radius:4px;padding:5px 8px;}
    .ruyi-prompt button {cursor:pointer;white-space:nowrap;}
    .ruyi-prompt-add-icon {color:#83ce8d;font-weight:bold;font-size:14px;}
    .ruyi-prompt button:hover {background:var(--ruyi-hover-bg);} .ruyi-prompt button:disabled {opacity:.4;cursor:default;}
    .ruyi-prompt-toolbar,.ruyi-prompt-heading,.ruyi-prompt-section-head {display:flex;align-items:center;gap:6px;}
    .ruyi-prompt-search {flex:1;min-width:80px;} .ruyi-prompt-matches {font-variant-numeric:tabular-nums;min-width:30px;text-align:center;}
    .ruyi-prompt-settings {padding:8px;margin-top:8px;border:1px solid var(--ruyi-border);border-radius:4px;display:flex;flex-wrap:wrap;gap:10px;}
    .ruyi-prompt-settings[hidden] {display:none;} .ruyi-prompt-settings label {display:inline-flex;align-items:center;gap:4px;}
    .ruyi-prompt-settings input[type=text] {width:100%;} .ruyi-prompt-status {width:100%;font-size:11px;color:var(--ruyi-muted);} .ruyi-prompt-statistics {display:flex;gap:18px;font-size:11px;color:var(--ruyi-muted);margin-top:7px;}
    .ruyi-prompt-group {margin-top:10px;border:1px solid var(--ruyi-border);border-radius:5px;padding:8px;}
    .ruyi-prompt-group[data-side=positive] {border-left:3px solid #80bb82;} .ruyi-prompt-group[data-side=negative] {border-left:3px solid #ca9090;}
    .ruyi-prompt-heading {justify-content:space-between;margin-bottom:6px;}
    .ruyi-prompt-section {border:1px solid var(--ruyi-border);border-radius:4px;margin-top:6px;overflow:hidden;background:var(--ruyi-content-bg);}
    .ruyi-prompt-section.disabled {opacity:.6;} .ruyi-prompt-section-head {padding:5px;background:var(--ruyi-group-bg);}
    .ruyi-prompt-title {flex:1;min-width:60px;} .ruyi-prompt-section-head button {min-height:28px;height:28px;padding:3px 8px;border:1px solid var(--ruyi-border);border-radius:5px;background:var(--ruyi-control-bg);}
    .ruyi-prompt-section-head button:hover {background:var(--ruyi-hover-bg);} .ruyi-prompt-section-head button:disabled {opacity:.45;cursor:default;}
    .ruyi-prompt-section-head [data-action=delete] {color:#f2b0b0;}
    .ruyi-prompt-toggle-box {height:28px;min-height:28px;display:inline-flex;align-items:center;gap:7px;padding:3px 7px;border:1px solid var(--ruyi-border);border-radius:5px;background:var(--ruyi-control-bg);white-space:nowrap;cursor:pointer;}
    .ruyi-prompt-round-toggle {appearance:none;-webkit-appearance:none;width:18px;height:18px;min-width:18px;flex:0 0 18px;margin:0;border-radius:50%;border:1px solid #797979;background:var(--ruyi-content-bg);cursor:pointer;transition:background-color .12s ease,box-shadow .12s ease,border-color .12s ease;}
    .ruyi-prompt-round-toggle:checked {background:#bdbdbd;border-color:#c6c6c6;box-shadow:inset 0 0 0 4px var(--ruyi-control-bg);}
    .ruyi-prompt-round-toggle:hover {border-color:var(--ruyi-muted);} .ruyi-prompt-round-toggle:focus-visible {outline:1px solid #aaa;outline-offset:1px;}
    .ruyi-prompt-font-setting {display:inline-flex;align-items:center;gap:6px;}
    .ruyi-prompt-number {height:28px;border:1px solid var(--ruyi-border);border-radius:4px;background:var(--ruyi-control-bg);overflow:hidden;display:inline-flex;align-items:center;}
    .ruyi-prompt-number input[type=number] {appearance:textfield;-moz-appearance:textfield;width:36px;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:center;}
    .ruyi-prompt-number input::-webkit-inner-spin-button,.ruyi-prompt-number input::-webkit-outer-spin-button {appearance:none;-webkit-appearance:none;margin:0;}
    .ruyi-prompt-number button {width:20px;height:100%;padding:0;border:0;border-radius:0;background:transparent;font-size:12px;}
    .ruyi-prompt-number button:hover {background:var(--ruyi-hover-bg);}
    .ruyi-prompt-edit-wrap {position:relative;height:128px;}
    .ruyi-prompt textarea[data-section],.ruyi-prompt-overlay {position:absolute;left:0;top:0;height:100%;margin:0;border:0;padding:9px;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;font:var(--ruyi-prompt-font-size,13px)/1.6 Consolas,'Courier New',monospace;tab-size:4;}
    .ruyi-prompt textarea[data-section] {width:calc(100% - 18px);resize:none;overflow-y:scroll;scrollbar-width:none;background:transparent!important;color:transparent!important;-webkit-text-fill-color:transparent;caret-color:var(--ruyi-text);outline:none;z-index:1;}
    .ruyi-prompt textarea[data-section]::selection {background:rgba(75,130,195,.45);color:transparent;}
    .ruyi-prompt-overlay {pointer-events:none;overflow:hidden;color:var(--ruyi-text);}
    .ruyi-prompt textarea[data-section]::-webkit-scrollbar {width:0;}
    .ruyi-prompt-scrollbar {position:absolute;right:1px;top:0;width:16px;height:100%;background:var(--ruyi-content-bg);cursor:default;touch-action:none;z-index:2;}
    .ruyi-prompt-scroll-thumb {position:absolute;left:2px;width:12px;min-height:24px;border-radius:7px;background:#777;cursor:default;}
    .ruyi-prompt-scrollbar:hover .ruyi-prompt-scroll-thumb {background:#999;} .ruyi-prompt-scrollbar[aria-disabled=true] .ruyi-prompt-scroll-thumb {display:none;}
    .ruyi-prompt-resize {height:9px;cursor:ns-resize;touch-action:none;background:var(--ruyi-group-bg);position:relative;}
    .ruyi-prompt-resize::after {content:'';display:block;position:absolute;left:calc(50% - 18px);top:3px;width:36px;height:2px;background:#666;}
    .ruyi-prompt-resize:hover,.ruyi-prompt-resize:focus-visible {background:var(--ruyi-control-bg);outline:none;}
    .ruyi-prompt-match {background:#806b22;color:inherit;} .ruyi-prompt-misspelled {text-decoration:underline wavy #ed7676;text-decoration-skip-ink:none;}
    .ruyi-prompt-error-list {display:flex;gap:5px;flex-wrap:wrap;align-items:center;padding:6px 8px;font-size:11px;}
    .ruyi-prompt-error-list:empty {display:none;} .ruyi-prompt-error-list button {padding:1px 5px;color:#efa0a0;}
    .ruyi-prompt-popup {position:fixed;z-index:100020;background:var(--ruyi-control-bg);color:var(--ruyi-text);border:1px solid var(--ruyi-border);border-radius:5px;padding:4px;max-height:300px;overflow:auto;box-shadow:0 5px 15px #0008;font:13px Arial,sans-serif;}
    .ruyi-prompt-popup button {display:block;width:100%;text-align:left;background:transparent;color:inherit;border:0;border-radius:3px;padding:6px 8px;cursor:pointer;font:inherit;}
    .ruyi-prompt-popup button:hover,.ruyi-prompt-popup button[aria-selected=true] {background:var(--ruyi-hover-bg);}
    .ruyi-prompt-popup small {display:block;color:var(--ruyi-muted);margin-top:2px;}
    `;
    document.head.append(style);
}

export function createPromptWidget(node, inputName, app) {
    installStyles();
    const locale = String(app.extensionManager?.setting?.get?.('Comfy.Locale') || document.documentElement.lang || 'zh');
    const tr = key => labels[locale.startsWith('en') ? 'en' : 'zh'][key];
    const section = (title) => ({id:crypto.randomUUID(),title,text:'',enabled:true,collapsed:false,height:128});
    let state = {version:1,positive:[section(tr('global'))],negative:[section(tr('negative'))],
        settings:{fontSize:13,negativeEnabled:true,autocomplete:true,spelling:true,underscores:false,sources:['local','danbooru'],customWords:[]}};
    let rawInvalid = null, disposed = false, popup = null, selected = 0, candidates = [], active = null, popupToken = null, queryRevision = 0;
    let matchIndex = -1, triggers = '', resizeQueued = false, popupText = '', popupCaret = -1, exactFit = false, resizing = false, statsRevision = 0, statsTimer = null, tagHits = 0;
    const heightOf = value => Math.max(80,Math.min(2000,Number.isFinite(Number(value))?Number(value):128));
    const fontSizeOf = value => Math.max(10,Math.min(32,Math.round(Number.isFinite(Number(value))&&Number(value)>0?Number(value):13)));
    const fontInputId = `ruyi-prompt-font-${crypto.randomUUID()}`;
    const editors = new Map(), ignored = new Set(), timers = new Set();
    const panel = el('div','ruyi-prompt'), toolbar = el('div','ruyi-prompt-toolbar');
    const search = el('input','ruyi-prompt-search');search.type='text';search.placeholder=tr('search');search.setAttribute('aria-label',tr('search'));
    const count = el('span','ruyi-prompt-matches'), tagCount = el('span'), statistics = el('div','ruyi-prompt-statistics'), settingsPanel = el('div','ruyi-prompt-settings');settingsPanel.hidden=true;
    const button = (text, action, title) => {const b=el('button','',text);b.type='button';if(action)b.dataset.action=action;if(title){b.title=title;b.setAttribute('aria-label',title);}return b;};
    const previous=button('‹','previous-match',tr('previous')), next=button('›','next-match',tr('next')), settingsButton=button(tr('settings'));
    settingsButton.setAttribute('aria-expanded','false');toolbar.append(search,previous,next,settingsButton);statistics.append(count,tagCount);tagCount.title=tr('tagHelp');
    const status=el('div','ruyi-prompt-status',tr('loading')), groups=el('div');
    panel.append(toolbar,settingsPanel,statistics,groups);
    const closePopup = () => {popup?.remove();popup=null;candidates=[];queryRevision++;
        for(const editor of editors.values()){clearTimeout(editor.completionTimer);timers.delete(editor.completionTimer);editor.completionTimer=null;editor.completionWanted=false;}
    };
    const changed = () => {rawInvalid=null;app.graph?.setDirtyCanvas?.(true,true);};
    const requiredHeight = () => Math.max(330,node.computeSize?.()[1] || panel.scrollHeight+82);
    const constrain = () => {
        if(resizing||disposed)return;
        const height=requiredHeight();node.min_size=[700,height];
        if((node.size?.[1]||0)<height||(node.size?.[0]||0)<700){
            resizing=true;try{node.setSize?.([Math.max(700,node.size?.[0]||800),Math.max(height,node.size?.[1]||0)]);}finally{resizing=false;}
        }
    };
    const fit = (exact=false) => {
        exactFit ||= exact;if(resizeQueued||disposed)return;resizeQueued=true;
        requestAnimationFrame(()=>{resizeQueued=false;if(disposed)return;
            const height=requiredHeight();node.min_size=[700,height];
            const target=exactFit?height:Math.max(height,node.size?.[1]||0);exactFit=false;
            if(Math.abs((node.size?.[1]||0)-target)>1)node.setSize?.([Math.max(700,node.size?.[0]||800),target]);
            for(const e of editors.values())syncScroll(e);node.setDirtyCanvas?.(true,true);
        });
    };
    const visibleEditors = () => [...editors.values()].filter(e=>e.side!=='negative'||state.settings.negativeEnabled);
    function matchSummary() {
        const total=visibleEditors().reduce((sum,e)=>sum+e.matches.length,0);
        if(matchIndex>=total)matchIndex=-1;
        count.textContent=`${tr('searchHits')}：${matchIndex<0?total:`${matchIndex+1} / ${total}`}`;
        previous.disabled=next.disabled=!total;
        tagCount.textContent=`${tr('tagHits')}：${tagHits.toLocaleString()}`;
    }
    function vocabularyStats() {
        const revision=++statsRevision;clearTimeout(statsTimer);timers.delete(statsTimer);
        statsTimer=setTimeout(async()=>{timers.delete(statsTimer);
            const texts=visibleEditors().filter(e=>e.item.enabled).map(e=>e.input.value);
            try{const count=await request('stats',{texts});if(!disposed&&revision===statsRevision){tagHits=count;matchSummary();}}
            catch(error){if(!disposed)status.textContent=`${tr('unavailable')}：${error.message}`;}
        },200);timers.add(statsTimer);
    }
    function syncScroll(editor) {
        const {input,overlay,bar,thumb}=editor;
        overlay.scrollTop=input.scrollTop;overlay.scrollLeft=input.scrollLeft;
        const height=input.clientHeight,max=Math.max(0,input.scrollHeight-height),thumbHeight=Math.min(height,Math.max(24,height*height/(input.scrollHeight||1)));
        thumb.style.height=`${thumbHeight}px`;thumb.style.top=`${max?input.scrollTop/max*(height-thumbHeight):0}px`;
        bar.setAttribute('aria-valuemax',String(max));bar.setAttribute('aria-valuenow',String(Math.round(input.scrollTop)));bar.setAttribute('aria-disabled',String(!max));
    }
    function revealRange(editor,start,end) {
        if(editor.item.collapsed)editor.input.closest('.ruyi-prompt-section').querySelector('[data-action=collapse]').click();
        closePopup();const {input,overlay}=editor;input.focus({preventScroll:true});input.setSelectionRange(start,end);
        // Measure the rendered overlay so wrapped lines and canvas zoom use the same geometry as the text.
        const walker=document.createTreeWalker(overlay,NodeFilter.SHOW_TEXT);let current,offset=0,first,last;
        while((current=walker.nextNode())){const length=current.textContent.length;
            if(!first&&start<=offset+length)first=[current,Math.max(0,start-offset)];
            if(end<=offset+length){last=[current,Math.max(0,end-offset)];break;}offset+=length;
        }
        if(first&&last){const range=document.createRange();range.setStart(...first);range.setEnd(...last);
            const rect=range.getBoundingClientRect(),box=input.getBoundingClientRect(),scale=box.height/input.offsetHeight||1;
            input.scrollTop=Math.max(0,input.scrollTop+(rect.top-box.top)/scale-input.clientHeight/2+rect.height/scale/2);
        }
        syncScroll(editor);input.scrollIntoView({block:'nearest',inline:'nearest'});
    }
    function paint(editor) {
        const {input,overlay,errors}=editor,text=input.value, query=search.value.toLowerCase();
        const matches=[];if(query)for(let start=0;(start=text.toLowerCase().indexOf(query,start))>=0;start+=query.length)matches.push({start,end:start+query.length});
        editor.matches=matches;
        const ranges=[...matches,...errors], boundaries=new Set([0,text.length]);for(const range of ranges){boundaries.add(range.start);boundaries.add(range.end);}
        const offsets=[...boundaries].sort((a,b)=>a-b);overlay.replaceChildren();
        for(let i=0;i<offsets.length-1;i++) {
            const start=offsets[i],end=offsets[i+1],span=el('span','',text.slice(start,end));
            if(matches.some(r=>start>=r.start&&end<=r.end))span.classList.add('ruyi-prompt-match');
            if(errors.some(r=>start>=r.start&&end<=r.end))span.classList.add('ruyi-prompt-misspelled');overlay.append(span);
        }
        overlay.append(document.createTextNode('\n'));overlay.style.width=`${input.clientWidth}px`;overlay.scrollTop=input.scrollTop;overlay.scrollLeft=input.scrollLeft;
        syncScroll(editor);matchSummary();
    }
    function renderErrors(editor) {
        const list=editor.errorList, available=new Map();
        for(const b of list.querySelectorAll('button')){const queue=available.get(b.textContent)||[];queue.push(b);available.set(b.textContent,queue);}
        const desired=[];
        if(editor.errors.length)desired.push(list.querySelector('.ruyi-prompt-error-label')||el('span','ruyi-prompt-error-label',tr('spellingErrors')));
        for(const error of editor.errors.slice(0,20)){
            const b=available.get(error.word)?.shift()||button(error.word,null,tr('word'));b.onclick=()=>showSpelling(editor,error,b);desired.push(b);
        }
        desired.forEach((child,index)=>{if(list.children[index]!==child)list.insertBefore(child,list.children[index]||null);});
        while(list.children.length>desired.length)list.lastElementChild.remove();
    }
    function spelling(editor) {
        if(!state.settings.spelling){editor.revision++;editor.errors=[];renderErrors(editor);paint(editor);fit();return;}
        const text=editor.input.value, revision=++editor.revision;
        request('spell',{text,customWords:[...state.settings.customWords,...ignored],triggers}).then(errors=>{
            if(disposed||editor.revision!==revision||editor.input.value!==text||!state.settings.spelling)return;
            editor.errors=errors;paint(editor);renderErrors(editor);
            fit();
        }).catch(error=>{if(!disposed)status.textContent=`${tr('unavailable')}：${error.message}`;});
    }
    function delayed(editor) {
        clearTimeout(editor.timer);timers.delete(editor.timer);
        editor.timer=setTimeout(()=>{timers.delete(editor.timer);if(!editor.composing)spelling(editor);},500);timers.add(editor.timer);
    }
    function popupAt(anchor) {
        closePopup();popup=el('div','ruyi-prompt-popup');popup.setAttribute('role','listbox');document.body.append(popup);
        const rect=anchor.getBoundingClientRect(),width=Math.min(420,Math.max(260,rect.width));
        popup.style.width=`${width}px`;popup.style.left=`${Math.max(4,Math.min(rect.left,innerWidth-width-4))}px`;
        popup.style.top=`${Math.max(4,Math.min(rect.bottom,innerHeight-310))}px`;return popup;
    }
    function replace(editor,start,end,text) {
        const input=editor.input;input.focus();input.setSelectionRange(start,end);
        // Native insertion preserves textarea undo history; the fallback is for browsers without this command.
        if(!document.execCommand('insertText',false,text)) {input.setRangeText(text,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}
        closePopup();
    }
    async function showSpelling(editor,error,anchor) {
        const original=editor.input.value;popupAt(anchor);const popupHere=popup;
        const add = (text,action) => {const b=button(text);b.onclick=action;popupHere.append(b);};
        add(`${tr('locate')}：${error.word}`,()=>{if(editor.input.value===original)revealRange(editor,error.start,error.end);else closePopup();});
        add(`${tr('ignore')}：${error.word}`,()=>{ignored.add(error.word);closePopup();spelling(editor);});
        add(tr('learn'),()=>{state.settings.customWords.push(error.word);changed();renderSettings();closePopup();for(const e of editors.values())spelling(e);});
        try {
            const options=await request('suggest',{word:error.word});if(disposed||popup!==popupHere||editor.input.value!==original)return;
            for(const word of options)add(word,()=>replace(editor,error.start,error.end,word));
            if(!options.length)popupHere.append(el('small','',tr('noSuggestions')));
        } catch(error){status.textContent=`${tr('unavailable')}：${error.message}`;}
    }
    async function completion(editor) {
        const input=editor.input;
        if(editor.composing||!state.settings.autocomplete||document.activeElement!==input||input.selectionStart!==input.selectionEnd){closePopup();return;}
        const revision=++queryRevision,text=input.value,caret=input.selectionStart;
        try {
            const {token,options}=await request('complete_at',{text,caret,sources:state.settings.sources});
            if(disposed||revision!==queryRevision||input.value!==text||input.selectionStart!==caret||input.selectionEnd!==caret||editor.composing||document.activeElement!==input)return;
            if(!options.length){closePopup();return;}
            popupAt(input);active=editor;popupToken=token;popupText=text;popupCaret=caret;selected=0;candidates=options;editor.completionWanted=true;
            options.forEach((row,index)=>{const b=button(insertion(row[0],state.settings.underscores));b.setAttribute('role','option');b.setAttribute('aria-selected',String(index===0));
                const alias=matchedAlias(row,token.text);
                b.append(el('small','',[alias?`${tr('alias')}：${alias}`:'',row[4],row[1],row[5].join(' / ')].filter(Boolean).join(' · ')));
                b.onpointerdown=event=>event.preventDefault();b.onclick=()=>{
                    if(input.value===text&&input.selectionStart===caret&&input.selectionEnd===caret)replace(editor,token.start,token.end,insertion(row[0],state.settings.underscores));
                    else closePopup();
                };popup.append(b);});
        }catch(error){if(!disposed)status.textContent=`${tr('unavailable')}：${error.message}`;}
    }
    function scheduleCompletion(editor) {
        closePopup();
        if(disposed||editor.composing||!state.settings.autocomplete||document.activeElement!==editor.input||editor.input.selectionStart!==editor.input.selectionEnd)return;
        editor.completionWanted=true;
        editor.completionTimer=setTimeout(()=>{timers.delete(editor.completionTimer);editor.completionTimer=null;completion(editor);},120);timers.add(editor.completionTimer);
    }
    function renderSettings() {
        settingsPanel.replaceChildren();
        const fontSetting=el('div','ruyi-prompt-font-setting'),fontLabel=el('label','',tr('fontSize')),fontControl=el('span','ruyi-prompt-number'),fontInput=el('input');
        fontInput.type='number';fontInput.min='10';fontInput.max='32';fontInput.step='1';fontInput.id=fontInputId;fontInput.value=String(state.settings.fontSize);fontInput.setAttribute('aria-label',tr('fontSize'));fontLabel.htmlFor=fontInputId;
        const decrease=button('◀','font-decrease',tr('fontDecrease')),increase=button('▶','font-increase',tr('fontIncrease'));
        const commitFont=value=>{state.settings.fontSize=fontSizeOf(value);fontInput.value=String(state.settings.fontSize);panel.style.setProperty('--ruyi-prompt-font-size',`${state.settings.fontSize}px`);changed();closePopup();for(const e of editors.values())paint(e);fit();};
        fontInput.oninput=()=>{const value=Number(fontInput.value);if(fontInput.value.trim()&&Number.isInteger(value)&&value>=10&&value<=32)commitFont(value);};
        fontInput.onchange=()=>commitFont(fontInput.value.trim()?fontInput.value:state.settings.fontSize);
        decrease.onclick=()=>commitFont(state.settings.fontSize-1);increase.onclick=()=>commitFont(state.settings.fontSize+1);
        fontControl.append(decrease,fontInput,increase);fontSetting.append(fontLabel,fontControl,el('span','','px'));settingsPanel.append(fontSetting);
        const toggle=(name,key,checked,update)=>{const label=el('label','',name),input=el('input');input.type='checkbox';input.checked=checked;
            input.onchange=()=>{update(input.checked);changed();closePopup();for(const e of editors.values())spelling(e);};label.prepend(input);settingsPanel.append(label);};
        toggle(tr('negativeEnabled'),'negativeEnabled',state.settings.negativeEnabled,value=>{
            state.settings.negativeEnabled=value;groups.querySelector('[data-side=negative]').hidden=!value;matchIndex=-1;matchSummary();vocabularyStats();fit(true);
        });
        for(const key of ['autocomplete','spelling','underscores'])toggle(tr(key==='autocomplete'?'completion':key==='underscores'?'underscore':key),key,state.settings[key],value=>state.settings[key]=value);
        for(const source of ['local','danbooru','import'])toggle(tr(source==='import'?'imported':source),source,state.settings.sources.includes(source),value=>{
            state.settings.sources=state.settings.sources.filter(x=>x!==source);if(value)state.settings.sources.push(source);
        });
        const words=el('input');words.type='text';words.placeholder=tr('words');words.setAttribute('aria-label',tr('words'));words.value=state.settings.customWords.join(', ');
        words.onchange=()=>{state.settings.customWords=[...new Set(words.value.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean))];changed();for(const e of editors.values())spelling(e);};
        const importButton=button(tr('import')),file=el('input');file.type='file';file.accept='.csv,text/csv';file.hidden=true;
        importButton.onclick=()=>file.click();file.onchange=async()=>{
            if(!file.files?.length)return;status.textContent=tr('loading');
            try {const result=await request('import',{csv:await file.files[0].text()});if(disposed)return;
                if(!state.settings.sources.includes('import'))state.settings.sources.push('import');changed();renderSettings();status.textContent=`${tr('importSession')}：${result.count}`;
                for(const e of editors.values())spelling(e);vocabularyStats();fit();
            }catch(error){status.textContent=`${tr('unavailable')}：${error.message}`;}
        };settingsPanel.append(words,importButton,file,status);
    }
    function renderGroups() {
        closePopup();for(const e of editors.values()){clearTimeout(e.timer);timers.delete(e.timer);e.revision++;}
        editors.clear();groups.replaceChildren();
        for(const side of ['positive','negative']) {
            const group=el('div','ruyi-prompt-group');group.dataset.side=side;group.hidden=side==='negative'&&!state.settings.negativeEnabled;
            const header=el('div','ruyi-prompt-heading'),add=button(tr('add'));add.dataset.add=side;
            const addIcon=el('span','ruyi-prompt-add-icon','✚');addIcon.setAttribute('aria-hidden','true');add.prepend(addIcon,document.createTextNode(' '));
            add.onclick=()=>{state[side].push(section(`${tr('section')} ${state[side].length+1}`));changed();renderGroups();};
            header.append(el('strong','',tr(side)),add);group.append(header);
            state[side].forEach((item,index)=>{
                const card=el('div','ruyi-prompt-section');card.classList.toggle('disabled',!item.enabled);
                const head=el('div','ruyi-prompt-section-head'),title=el('input','ruyi-prompt-title');title.type='text';title.value=item.title;
                title.setAttribute('aria-label',`${tr(side)} ${tr('section')} ${index+1}`);title.oninput=()=>{item.title=title.value;changed();};
                const collapse=button(item.collapsed?'▸':'▾','collapse',tr(item.collapsed?'expand':'collapse')),
                      up=button('↑','up',tr('up')),down=button('↓','down',tr('down')),remove=button(`❌ ${tr('delete')}`,'delete',tr('delete'));
                const enableBox=el('label','ruyi-prompt-toggle-box'),enable=el('input','ruyi-prompt-round-toggle');enable.type='checkbox';enable.dataset.action='enable';enable.checked=item.enabled;enable.title=tr('enable');enable.setAttribute('aria-label',tr('enable'));enableBox.append(el('span','',tr('onOff')),enable);
                up.disabled=index===0;down.disabled=index===state[side].length-1;remove.disabled=state[side].length===1;
                head.append(collapse,title,up,down,enableBox,remove);
                const wrap=el('div','ruyi-prompt-edit-wrap'),overlay=el('pre','ruyi-prompt-overlay'),input=el('textarea');input.dataset.section=item.id;input.value=item.text;
                input.spellcheck=false;input.setAttribute('aria-label',`${tr(side)} ${index+1}`);overlay.setAttribute('aria-hidden','true');wrap.style.height=`${heightOf(item.height)}px`;
                const bar=el('div','ruyi-prompt-scrollbar'),thumb=el('div','ruyi-prompt-scroll-thumb');bar.tabIndex=0;bar.setAttribute('role','scrollbar');bar.setAttribute('aria-label',`${tr(side)} ${index+1} ${tr('scrollbar')}`);bar.setAttribute('aria-orientation','vertical');bar.setAttribute('aria-valuemin','0');
                input.id=`ruyi-prompt-${item.id}`;bar.setAttribute('aria-controls',input.id);bar.append(thumb);wrap.append(overlay,input,bar);
                const errorList=el('div','ruyi-prompt-error-list');const grip=el('div','ruyi-prompt-resize');grip.setAttribute('role','separator');grip.setAttribute('aria-label',`${tr(side)} ${index+1} ${tr('resize')}`);grip.setAttribute('aria-orientation','horizontal');grip.tabIndex=0;
                card.append(head,wrap,grip,errorList);wrap.hidden=grip.hidden=item.collapsed;errorList.hidden=item.collapsed;
                const editor={input,overlay,errorList,item,side,bar,thumb,errors:[],matches:[],revision:0,composing:false,timer:null};editors.set(item.id,editor);
                input.oninput=event=>{closePopup();editor.errors=rebaseSpelling(editor.errors,item.text,input.value);item.text=input.value;editor.revision++;renderErrors(editor);matchIndex=-1;changed();paint(editor);vocabularyStats();
                    if(!editor.composing&&!event.isComposing){delayed(editor);scheduleCompletion(editor);}};
                input.addEventListener('compositionstart',()=>{editor.composing=true;editor.revision++;closePopup();clearTimeout(editor.timer);timers.delete(editor.timer);});
                input.addEventListener('compositionend',()=>{editor.composing=false;editor.errors=rebaseSpelling(editor.errors,item.text,input.value);item.text=input.value;renderErrors(editor);changed();paint(editor);vocabularyStats();delayed(editor);scheduleCompletion(editor);});
                input.onscroll=()=>{syncScroll(editor);if(!popup&&editor.completionWanted)scheduleCompletion(editor);};
                input.onfocus=()=>scheduleCompletion(editor);input.onblur=closePopup;
                input.onpointerup=()=>scheduleCompletion(editor);
                input.onkeyup=event=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key)||(!popup&&['ArrowUp','ArrowDown'].includes(event.key)))scheduleCompletion(editor);};
                let scrollDrag=null;
                bar.onpointerdown=event=>{event.preventDefault();closePopup();
                    const scale=bar.getBoundingClientRect().height/bar.offsetHeight||1;
                    if(event.target!==thumb){const y=(event.clientY-bar.getBoundingClientRect().top)/scale;input.scrollTop=(y-thumb.offsetHeight/2)/Math.max(1,bar.offsetHeight-thumb.offsetHeight)*(input.scrollHeight-input.clientHeight);syncScroll(editor);}
                    scrollDrag={y:event.clientY,top:input.scrollTop,scale};bar.setPointerCapture(event.pointerId);
                };
                bar.onpointermove=event=>{if(!scrollDrag)return;input.scrollTop=scrollDrag.top+(event.clientY-scrollDrag.y)/scrollDrag.scale/Math.max(1,bar.offsetHeight-thumb.offsetHeight)*(input.scrollHeight-input.clientHeight);syncScroll(editor);};
                bar.onpointerup=bar.onpointercancel=bar.onlostpointercapture=()=>{scrollDrag=null;};
                bar.onkeydown=event=>{const values={ArrowDown:32,ArrowUp:-32,PageDown:input.clientHeight,PageUp:-input.clientHeight,Home:-input.scrollHeight,End:input.scrollHeight};
                    if(event.key in values){event.preventDefault();input.scrollTop+=values[event.key];syncScroll(editor);}
                };
                let heightDrag=null;
                const resizeTo=height=>{item.height=heightOf(height);wrap.style.height=`${item.height}px`;grip.setAttribute('aria-valuenow',String(item.height));changed();paint(editor);fit(true);};
                grip.setAttribute('aria-valuemin','80');grip.setAttribute('aria-valuemax','2000');grip.setAttribute('aria-valuenow',String(heightOf(item.height)));
                grip.onpointerdown=event=>{event.preventDefault();closePopup();heightDrag={y:event.clientY,height:wrap.offsetHeight,scale:wrap.getBoundingClientRect().height/wrap.offsetHeight||1};grip.setPointerCapture(event.pointerId);};
                grip.onpointermove=event=>{if(heightDrag)resizeTo(heightDrag.height+(event.clientY-heightDrag.y)/heightDrag.scale);};
                grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=()=>{heightDrag=null;};
                grip.onkeydown=event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();resizeTo(wrap.offsetHeight+(event.key==='ArrowDown'?1:-1)*(event.shiftKey?40:16));}};
                input.onpointerdown=closePopup;
                input.onkeydown=event=>{
                    if(event.isComposing||editor.composing)return;
                    if(popup&&active===editor&&candidates.length&&
                        (input.value!==popupText||input.selectionStart!==popupCaret||input.selectionEnd!==popupCaret))closePopup();
                    if(popup&&active===editor&&candidates.length&&['ArrowDown','ArrowUp','Enter','Tab','Escape'].includes(event.key)){
                        event.preventDefault();event.stopPropagation();
                        if(event.key==='Escape')closePopup();
                        else if(['Enter','Tab'].includes(event.key))replace(editor,popupToken.start,popupToken.end,insertion(candidates[selected][0],state.settings.underscores));
                        else{selected=(selected+(event.key==='ArrowDown'?1:-1)+candidates.length)%candidates.length;
                            [...popup.children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===selected)));popup.children[selected].scrollIntoView({block:'nearest'});}
                    }else closePopup();
                };
                collapse.onclick=()=>{item.collapsed=!item.collapsed;wrap.hidden=grip.hidden=item.collapsed;errorList.hidden=item.collapsed;collapse.textContent=item.collapsed?'▸':'▾';changed();paint(editor);fit(true);};
                enable.onchange=()=>{item.enabled=enable.checked;card.classList.toggle('disabled',!item.enabled);changed();vocabularyStats();};
                for(const [b,offset] of [[up,-1],[down,1]])b.onclick=()=>{const items=state[side];[items[index],items[index+offset]]=[items[index+offset],items[index]];changed();renderGroups();};
                remove.onclick=()=>{state[side].splice(index,1);changed();renderGroups();};group.append(card);
                requestAnimationFrame(()=>{if(disposed)return;paint(editor);if(input.value)delayed(editor);});
            });groups.append(group);
        }matchIndex=-1;matchSummary();vocabularyStats();fit(true);
    }
    function navigate(offset) {
        const matches=[];for(const editor of visibleEditors())for(const range of editor.matches)matches.push({editor,range});if(!matches.length)return;
        matchIndex=matchIndex<0?(offset>0?0:matches.length-1):(matchIndex+offset+matches.length)%matches.length;const {editor,range}=matches[matchIndex];
        revealRange(editor,range.start,range.end);matchSummary();
    }
    search.oninput=()=>{matchIndex=-1;for(const editor of editors.values())paint(editor);};
    search.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();navigate(event.shiftKey?-1:1);}else if(event.key==='Escape'){search.value='';search.dispatchEvent(new Event('input'));search.blur();}};
    next.onclick=()=>navigate(1);previous.onclick=()=>navigate(-1);
    settingsButton.onclick=()=>{settingsPanel.hidden=!settingsPanel.hidden;settingsButton.setAttribute('aria-expanded',String(!settingsPanel.hidden));closePopup();fit(true);};
    const outside=event=>{if(popup&&!popup.contains(event.target)&&event.target!==active?.input)closePopup();};
    const key=event=>{if(event.key==='Escape')closePopup();};
    const scroll=event=>{if([...editors.values()].some(e=>e.input===event.target||e.overlay===event.target))return;if(popup&&!popup.contains(event.target))closePopup();};
    panel.addEventListener('keydown',event=>event.stopPropagation());panel.addEventListener('pointerdown',event=>event.stopPropagation());
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);window.addEventListener('resize',closePopup);window.addEventListener('scroll',scroll,true);
    const observer=new ResizeObserver(()=>{for(const editor of editors.values())paint(editor);fit();});observer.observe(panel);
    const widget=node.addDOMWidget(inputName,'RUYI_PROMPT',panel,{hideOnZoom:false,selectOn:['focus','click'],
        getValue:()=>rawInvalid??JSON.stringify(state),setValue:value=>{
            try {
                const saved=JSON.parse(value);
                if(saved.version!==1||!['positive','negative'].every(side=>Array.isArray(saved[side])&&saved[side].every(x=>typeof x.text==='string')))throw Error(tr('invalid'));
                state={...saved,settings:{...state.settings,...saved.settings}};
                for(const side of ['positive','negative'])state[side]=saved[side].length?saved[side].map(x=>({...x,id:x.id||crypto.randomUUID(),title:x.title||tr(side),enabled:x.enabled!==false,collapsed:!!x.collapsed,height:heightOf(x.height)})):[section(tr(side))];
                state.settings.fontSize=fontSizeOf(saved.settings?.fontSize);panel.style.setProperty('--ruyi-prompt-font-size',`${state.settings.fontSize}px`);
                state.settings.negativeEnabled=saved.settings?.negativeEnabled!==false;
                state.settings.customWords=[...(saved.settings?.customWords||[])];state.settings.sources=[...(saved.settings?.sources||['local','danbooru'])];
                rawInvalid=null;renderSettings();renderGroups();
            }catch(error){rawInvalid=value;status.textContent=`${tr('invalid')}：${error.message}`;}
        },getMinHeight:()=>Math.max(300,panel.scrollHeight+12),getHeight:()=>Math.max(300,panel.scrollHeight+12),afterResize:()=>{for(const e of editors.values())paint(e);fit();}});
    widget.serialize=true;
    widget.computeSize=width=>[Math.max(700,width),Math.max(300,panel.scrollHeight+12)];
    widget.computeLayoutSize=()=>({minWidth:700,minHeight:Math.max(300,panel.scrollHeight+12)});
    const previousResize=node.onResize;
    node.onResize=function(...args){previousResize?.apply(this,args);constrain();for(const e of editors.values())paint(e);};
    const previousExecuted=node.onExecuted;
    node.onExecuted=function(message){previousExecuted?.call(this,message);triggers=message.trigger_words?.[0]||'';
        for(const editor of editors.values())spelling(editor);fit();};
    const previousRemoved=node.onRemoved;node.onRemoved=function(...args){disposed=true;closePopup();observer.disconnect();for(const timer of timers)clearTimeout(timer);
        document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',closePopup);window.removeEventListener('scroll',scroll,true);previousRemoved?.apply(this,args);};
    renderSettings();renderGroups();request('ready').then(result=>{if(!disposed){status.textContent=`${tr('ready')} · ${result.count.toLocaleString()}`;vocabularyStats();fit();}}).catch(error=>{if(!disposed)status.textContent=`${tr('unavailable')}：${error.message}`;});
    return {widget};
}
