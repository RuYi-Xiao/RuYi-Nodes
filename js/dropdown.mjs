// Shared select-only combobox for DOM panels rendered at ComfyUI canvas zoom.
// Keep focus on the trigger so node/dialog keyboard navigation remains predictable.
let activeClose = null;
let nextId = 0;
function installStyles() {
    if (document.getElementById('ruyi-dropdown-style')) return;
    const style = document.createElement('style');
    style.id = 'ruyi-dropdown-style';
    style.textContent = `
    .ruyi-dropdown {box-sizing:border-box;display:inline-flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;height:28px;padding:4px 8px;border:1px solid var(--ruyi-border,#505050);border-radius:5px;background:var(--ruyi-control-bg,#3a3a3a);color:inherit;font:inherit;text-align:left;cursor:pointer;}
    .ruyi-dropdown-label {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .ruyi-dropdown::after {content:'';width:6px;height:6px;flex:0 0 6px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:translateY(-2px) rotate(45deg);}
    .ruyi-dropdown:disabled {opacity:.45;cursor:default;}
    .ruyi-dropdown:focus-visible {outline:2px solid #86b6df;outline-offset:1px;}
    .ruyi-dropdown-menu {position:fixed;z-index:2147483647;box-sizing:border-box;overflow:auto;border:1px solid var(--ruyi-border,#505050);border-radius:5px;background:var(--ruyi-control-bg,#3a3a3a);color:var(--ruyi-text,#eeeeee);padding:var(--ruyi-dropdown-gap) 0;scrollbar-width:thin;cursor:default;}
    .ruyi-dropdown-menu button {box-sizing:border-box;display:block;width:100%;min-width:0;border:0;border-radius:0;padding:var(--ruyi-dropdown-option-padding);background:transparent;color:inherit;font:inherit!important;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
    .ruyi-dropdown-menu button[data-active=true] {background:var(--ruyi-hover-bg,#474747);}
    .ruyi-dropdown-menu button[aria-selected=true] {font-weight:600;}
    .ruyi-dropdown-menu button:disabled {opacity:.4;cursor:default;}
    `;
    document.head.append(style);
}

export function createDropdown({label, className = '', options = []} = {}) {
    installStyles();
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = `ruyi-dropdown ${className}`.trim();
    trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-label', label || '');
    trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
    const caption = document.createElement('span'); caption.className = 'ruyi-dropdown-label'; trigger.append(caption);
    const id = `ruyi-dropdown-${++nextId}`;
    let records = [], value = '', menu = null, active = -1, disposed = false;
    const sync = () => {
        const item = records.find(item => item.value === value);
        caption.textContent = item?.label || ''; caption.title = item?.label || '';
        trigger.dataset.value = value;
    };
    function close() {
        menu?.remove(); menu = null;
        trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant'); trigger.removeAttribute('aria-controls');
        document.removeEventListener('pointerdown', outside, true);
        window.removeEventListener('resize', close); window.removeEventListener('scroll', onScroll, true);
        if (activeClose === close) activeClose = null;
    }
    const containsTarget = target => trigger.contains(target) || !!menu?.contains(target);
    function outside(event) {if (!containsTarget(event.target)) close();}
    function onScroll(event) {if (!(event.target instanceof Node) || !menu?.contains(event.target)) close();}
    function highlight(index) {
        active = index;
        for (const [i, option] of [...menu.children].entries()) option.dataset.active = String(i === index);
        const option = menu.children[index];
        if (option) {trigger.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({block:'nearest'});}
    }
    function select(index) {
        if (!records[index] || records[index].disabled) return;
        const previous = value; value = records[index].value; sync(); close(); trigger.focus({preventScroll:true});
        if (value !== previous) trigger.dispatchEvent(new Event('change', {bubbles:true}));
    }
    function open() {
        if (disposed || trigger.disabled || !records.length || !trigger.isConnected) return;
        activeClose?.();
        trigger.focus({preventScroll:true});
        const rect = trigger.getBoundingClientRect();
        const scale = trigger.offsetWidth > 0 ? rect.width / trigger.offsetWidth : 1;
        const font = getComputedStyle(trigger);
        menu = document.createElement('div'); menu.className = 'ruyi-dropdown-menu'; menu.id = id;
        menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', trigger.getAttribute('aria-label'));
        Object.assign(menu.style, {width:`${rect.width}px`, fontFamily:font.fontFamily, fontSize:`${parseFloat(font.fontSize)*scale}px`, fontWeight:font.fontWeight, lineHeight:font.lineHeight==='normal'?'normal':`${parseFloat(font.lineHeight)*scale}px`, maxHeight:`${Math.min(280*scale,window.innerHeight-16)}px`, left:`${Math.max(0,Math.min(rect.left,window.innerWidth-rect.width))}px`});
        menu.style.setProperty('--ruyi-dropdown-option-padding', `${5*scale}px ${8*scale}px`);
        menu.style.setProperty('--ruyi-dropdown-gap', `${3*scale}px`);
        records.forEach((item, index) => {
            const option = document.createElement('button'); option.type='button'; option.tabIndex=-1;
            option.id=`${id}-${index}`; option.dataset.value=item.value; option.textContent=item.label; option.title=item.label; option.disabled=!!item.disabled;
            option.setAttribute('role','option'); option.setAttribute('aria-selected',String(item.value===value));
            option.addEventListener('pointerdown',event=>event.preventDefault());
            option.addEventListener('pointermove',()=>{if(!option.disabled)highlight(index);});
            option.addEventListener('click',event=>{event.stopPropagation();select(index);});
            menu.append(option);
        });
        document.body.append(menu);
        const menuHeight = menu.getBoundingClientRect().height;
        menu.style.top = `${rect.bottom+menuHeight>window.innerHeight?Math.max(0,rect.top-menuHeight):rect.bottom}px`;
        trigger.setAttribute('aria-expanded','true'); trigger.setAttribute('aria-controls',id);
        highlight(Math.max(0,records.findIndex(item=>item.value===value&&!item.disabled)));
        activeClose = close;
        document.addEventListener('pointerdown',outside,true); window.addEventListener('resize',close); window.addEventListener('scroll',onScroll,true);
    }
    function onClick(event) {event.stopPropagation();if(menu)close();else open();}
    function onKey(event) {
        if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
        if (event.key === 'Tab') {close();return;}
        if (event.key === 'Escape') {if(menu){event.preventDefault();event.stopPropagation();close();}return;}
        if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            if (!menu) {open();if(event.key!=='Home'&&event.key!=='End')return;}
            if (!menu) return;
            if (event.key==='Enter'||event.key===' ') {select(active);return;}
            const enabled=records.map((item,index)=>!item.disabled?index:-1).filter(index=>index>=0);
            const position=enabled.indexOf(active);
            const index=event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):enabled[Math.max(0,Math.min(enabled.length-1,position+(event.key==='ArrowDown'?1:-1)))];
            if(index!==undefined)highlight(index);
        }
    }
    Object.defineProperty(trigger,'value',{get:()=>value,set:next=>{value=String(next ?? '');sync();}});
    trigger.setOptions = next => {
        close(); records = next.map(item=>({...item,value:String(item.value),label:String(item.label)}));
        if (!records.some(item=>item.value===value)) value=records.find(item=>!item.disabled)?.value || '';
        sync();
    };
    trigger.close=close; trigger.containsTarget=containsTarget;
    trigger.dispose=()=>{disposed=true;close();trigger.removeEventListener('click',onClick);trigger.removeEventListener('keydown',onKey);trigger.removeEventListener('blur',close);};
    trigger.addEventListener('click',onClick); trigger.addEventListener('keydown',onKey); trigger.addEventListener('blur',close);
    trigger.setOptions(options);
    return trigger;
}
