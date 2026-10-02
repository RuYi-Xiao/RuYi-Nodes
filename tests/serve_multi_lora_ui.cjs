// Run with node tests/serve_multi_lora_ui.cjs, then open http://127.0.0.1:8199.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const catalog = [
    {lora:'Krea2/example.safetensors', folder:'Krea2', base_model:'Krea2', model_name:'Krea2 example'},
    {lora:'H3/example.safetensors', folder:'H3', base_model:'MiniMax H3', model_name:'H3 example'},
];
const appStub = `export const app = {
    extensions: [], graph: {setDirtyCanvas() {}},
    extensionManager: {setting: {get() {return document.documentElement.lang;}}},
    registerExtension(extension) {this.extensions.push(extension);}
};`;
http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/scripts/app.js') {
        response.setHeader('Content-Type', 'text/javascript'); response.end(appStub);
    } else if (url.pathname === '/extensions/RuYi/ruyi_multi_lora.js' || url.pathname === '/extensions/RuYi/theme.mjs') {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(fs.readFileSync(path.join(__dirname, '../js', path.basename(url.pathname))));
    } else if (url.pathname === '/ruyi_nodes/loras') {
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({items:catalog}));
    } else {
        response.setHeader('Content-Type', 'text/html');
        response.end(fs.readFileSync(path.join(__dirname, 'multi_lora_ui.html')));
    }
}).listen(8199, '127.0.0.1', () => console.log('RuYi UI tests: http://127.0.0.1:8199'));
