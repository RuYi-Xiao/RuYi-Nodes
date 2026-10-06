import {constrainCamera,zoomCamera,normalizeZoomLimit} from './camera.mjs';
import {isWorkflowShortcut} from '../ui_controls.mjs';

// Screen-space tolerance: canvas zoom must not change click/drag detection.
const DRAG_THRESHOLD=4;

function installStyles(){
    if(document.getElementById('ruyi-compare-viewport-style'))return;
    const style=document.createElement('style');style.id='ruyi-compare-viewport-style';
    style.textContent=`
    .ruyi-compare-zoom {position:absolute;left:10px;bottom:10px;z-index:6;display:flex;align-items:center;gap:8px;padding:4px 7px 4px 4px;border:1px solid var(--ruyi-border);border-radius:7px;background:rgba(41,41,41,.94);color:var(--ruyi-text);font:12px/1 system-ui;}
    .ruyi-compare-zoom button {box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:4px;border:1px solid var(--ruyi-border);border-radius:5px;background:var(--ruyi-control-bg);color:inherit;cursor:pointer;}
    .ruyi-compare-zoom button:hover:not(:disabled){background:var(--ruyi-hover-bg);}
    .ruyi-compare-zoom input[type=range] {appearance:none;width:120px;height:20px;padding:0;margin:0;background:transparent;cursor:pointer;}
    .ruyi-compare-zoom input::-webkit-slider-runnable-track {height:4px;border-radius:2px;background:#777;}
    .ruyi-compare-zoom input::-webkit-slider-thumb {appearance:none;width:14px;height:14px;margin-top:-5px;border:1px solid #ddd;border-radius:50%;background:#eee;}
    .ruyi-compare-zoom input::-moz-range-track {height:4px;border-radius:2px;background:#777;}
    .ruyi-compare-zoom input::-moz-range-thumb {width:14px;height:14px;border:1px solid #ddd;border-radius:50%;background:#eee;}
    .ruyi-compare-zoom :disabled {opacity:.4;cursor:default!important;}
    .ruyi-compare-zoom output {min-width:36px;text-align:right;font-variant-numeric:tabular-nums;}
    .ruyi-compare-zoom :focus-visible {outline:2px solid #86b6df;outline-offset:2px;}
    `;document.head.append(style);
}

export function createCompareViewport(stage,preview,{getMode,getMaxPercent,onWipe,onToggle,labels}){
    installStyles();
    const controls=document.createElement('div');controls.className='ruyi-compare-zoom';
    const reset=document.createElement('button');reset.type='button';reset.title=labels.reset;reset.setAttribute('aria-label',labels.reset);
    reset.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg>';
    const range=document.createElement('input');range.type='range';range.min='100';range.step='1';range.value='100';range.setAttribute('aria-label',labels.zoom);
    const percent=document.createElement('output');percent.setAttribute('aria-live','off');
    controls.append(reset,range,percent);preview.append(controls);
    let camera={percent:100,x:0,y:0},images=[],ready=false,gesture=null,disposed=false;
    const metrics=()=>({width:stage.clientWidth,height:stage.clientHeight,images});
    const cancelGesture=()=>{
        const pointerId=gesture?.id;gesture=null;
        if(pointerId!=null)try{if(stage.hasPointerCapture(pointerId))stage.releasePointerCapture(pointerId);}catch{}
        stage.style.cursor=ready&&camera.percent>100?'grab':getMode()==='wipe'?'crosshair':'pointer';
    };
    function refresh(){
        if(disposed)return;
        const bounds=metrics();camera=constrainCamera(camera,bounds,getMaxPercent());
        range.max=String(normalizeZoomLimit(getMaxPercent()));range.value=String(Math.round(camera.percent));percent.textContent=`${Math.round(camera.percent)}%`;
        range.disabled=reset.disabled=!ready;
        stage.dataset.zoomPercent=String(camera.percent);stage.dataset.panX=String(camera.x);stage.dataset.panY=String(camera.y);
        const transform=`translate(${camera.x*bounds.width}px, ${camera.y*bounds.height}px) scale(${camera.percent/100})`;
        for(const image of stage.querySelectorAll('img')){image.style.transformOrigin='50% 50%';image.style.transform=transform;}
        // The divider follows hover, so it is normally under the pointer when
        // pressing. Keep it decorative rather than stealing the pan gesture.
        const divider=stage.querySelector('[data-ruyi-divider]');if(divider)divider.style.pointerEvents='none';
        stage.style.cursor=gesture?'grabbing':ready&&camera.percent>100?'grab':getMode()==='wipe'?'crosshair':'pointer';
        range.setAttribute('aria-valuetext',`${Math.round(camera.percent)}%`);
        stage.title=camera.percent>100?labels.pan:labels.wheel;
    }
    function zoomTo(value,anchor={x:.5,y:.5}){
        cancelGesture();camera=zoomCamera(camera,value,anchor,metrics(),getMaxPercent());refresh();
    }
    function wheel(event){
        if(!ready)return;
        event.preventDefault();event.stopPropagation();
        const rect=stage.getBoundingClientRect();
        const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
        zoomTo(camera.percent-pixels*.1,{x:rect.width?(event.clientX-rect.left)/rect.width:.5,y:rect.height?(event.clientY-rect.top)/rect.height:.5});
    }
    function down(event){
        if(event.button!==0||!ready)return;
        event.preventDefault();event.stopPropagation();
        if(camera.percent<=100){if(getMode()==='wipe')onWipe(event.clientX);else onToggle();return;}
        if(gesture)return;
        gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:camera.x,y:camera.y,moved:false};
        try{stage.setPointerCapture(event.pointerId);}catch{}
        refresh();
    }
    function move(event){
        if(!ready)return;
        if(!gesture){if(event.buttons===0&&getMode()==='wipe')onWipe(event.clientX);return;}
        if(event.pointerId!==gesture.id)return;
        event.preventDefault();event.stopPropagation();
        const dx=event.clientX-gesture.startX,dy=event.clientY-gesture.startY;
        if(Math.hypot(dx,dy)>DRAG_THRESHOLD)gesture.moved=true;
        if(!gesture.moved)return;
        const rect=stage.getBoundingClientRect();
        camera={...camera,x:gesture.x+(rect.width?dx/rect.width:0),y:gesture.y+(rect.height?dy/rect.height:0)};refresh();
    }
    function up(event){
        if(!gesture||event.pointerId!==gesture.id)return;
        event.preventDefault();event.stopPropagation();
        // A release can arrive without a final pointermove (e.g. fast drags).
        const moved=gesture.moved||Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>DRAG_THRESHOLD;
        const click=!moved&&getMode()==='toggle';cancelGesture();
        if(click)onToggle();else refresh();
    }
    const controller=new AbortController(),signal=controller.signal;
    stage.addEventListener('wheel',wheel,{passive:false,signal});
    stage.addEventListener('pointerdown',down,{signal});stage.addEventListener('pointermove',move,{signal});stage.addEventListener('pointerup',up,{signal});
    stage.addEventListener('pointercancel',cancelGesture,{signal});stage.addEventListener('lostpointercapture',cancelGesture,{signal});
    reset.addEventListener('click',()=>{cancelGesture();camera={percent:100,x:0,y:0};refresh();},{signal});
    range.addEventListener('input',()=>{if(ready)zoomTo(Number(range.value));},{signal});
    controls.addEventListener('pointerdown',event=>event.stopPropagation(),{signal});controls.addEventListener('click',event=>event.stopPropagation(),{signal});
    controls.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();},{passive:false,signal});
    controls.addEventListener('keydown',event=>{if(!isWorkflowShortcut(event))event.stopPropagation();},{signal});
    const observer=new ResizeObserver(()=>refresh());observer.observe(stage);refresh();
    return {
        refresh,cancelGesture,controls,reset,range,
        loading(){cancelGesture();ready=false;refresh();},
        setImages(next){images=next.filter(Boolean).map(image=>({width:image.naturalWidth,height:image.naturalHeight}));ready=images.length>0;if(!ready)camera={percent:100,x:0,y:0};refresh();},
        dispose(){disposed=true;cancelGesture();controller.abort();observer.disconnect();controls.remove();},
    };
}
