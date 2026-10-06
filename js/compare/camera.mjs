const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeZoomLimit(value, fallback=300) {
    const number=Number(value);
    return value != null && value !== '' && Number.isFinite(number) && number >= 100 ? Math.floor(number) : fallback;
}

// Offsets are fractions of the viewport, independent of ComfyUI canvas zoom.
// Clamp against fitted image content, not the letterboxed <img> element.
export function constrainCamera(camera, metrics, maxPercent) {
    const percent=clamp(finite(camera.percent,100),100,normalizeZoomLimit(maxPercent));
    const {width,height,images=[]}=metrics;
    let contentWidth=0,contentHeight=0;
    if(width>0&&height>0)for(const image of images){
        if(!(image.width>0&&image.height>0))continue;
        const fit=Math.min(width/image.width,height/image.height)*percent/100;
        contentWidth=Math.max(contentWidth,image.width*fit);
        contentHeight=Math.max(contentHeight,image.height*fit);
    }
    const limitX=width>0?Math.max(0,(contentWidth-width)/(2*width)):0;
    const limitY=height>0?Math.max(0,(contentHeight-height)/(2*height)):0;
    return {percent,x:clamp(finite(camera.x),-limitX,limitX)||0,y:clamp(finite(camera.y),-limitY,limitY)||0};
}

export function zoomCamera(camera, percent, anchor, metrics, maxPercent) {
    const next=clamp(finite(percent,100),100,normalizeZoomLimit(maxPercent));
    const ratio=next/Math.max(100,finite(camera.percent,100));
    const x=clamp(finite(anchor.x,.5),0,1)-.5,y=clamp(finite(anchor.y,.5),0,1)-.5;
    return constrainCamera({percent:next,x:x-(x-finite(camera.x))*ratio,y:y-(y-finite(camera.y))*ratio},metrics,maxPercent);
}
