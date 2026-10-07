import {app} from '../../scripts/app.js';

// Separate entry so desktop profiles caching the older editor also load this fix.
app.registerExtension({
    name:'RuYi-Nodes.PromptCanvas',
    nodeCreated(node){
        if(node.comfyClass!=='RuYiPrompt'&&node.type!=='RuYiPrompt')return;
        for(const widget of node.widgets??[]){
            if(widget.type!=='RUYI_PROMPT')continue;
            widget.options.canvasOnly=true;
            // ComfyUI 1.53's legacy property panel writes its own small canvas
            // width onto the shared widget. The graph owns this editor's width.
            Object.defineProperty(widget,'width',{
                configurable:true,
                get:()=>Math.max(700,Number(node.size?.[0])||700),
                set:()=>{},
            });
        }
    },
});
