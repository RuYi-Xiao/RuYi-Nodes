import {app} from '../../scripts/app.js';
import {createPromptWidget} from './prompt/editor.mjs';

app.registerExtension({
    name:'RuYi-Nodes.Prompt',
    getCustomWidgets(){return {RUYI_PROMPT:(node,inputName)=>createPromptWidget(node,inputName,app)};},
    nodeCreated(node){
        if(node.comfyClass!=='RuYiPrompt'&&node.type!=='RuYiPrompt')return;
        node.min_size=[700,330];
        if(node.size[0]<700)node.setSize([800,node.size[1]]);
    },
});
