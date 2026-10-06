// Local-only fixture server: node tests/serve_image_compare_ui.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const appStub = `export const app = {
    extensions: [], graph: {_nodes: [], change() {}, setDirtyCanvas() {}},
    extensionManager: {setting: {get() {return document.documentElement.lang;}}},
    registerExtension(extension) {this.extensions.push(extension);}
};`;
const apiStub = `export const api = {
    apiURL(path) {return path;}, addEventListener() {},
    fetchApi() {throw new Error('Save requests are outside this UI test');}
};`;
const port = Number(process.env.RUYI_COMPARE_UI_PORT || 8200);
http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/scripts/app.js' || url.pathname === '/scripts/api.js') {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(url.pathname.endsWith('app.js') ? appStub : apiStub);
    } else if (['ruyi_image_compare.js','ruyi_multi_lora.js','theme.mjs','ui_controls.mjs','dropdown.mjs'].some(name=>url.pathname==='/extensions/RuYi/'+name)) {
        response.setHeader('Content-Type', 'text/javascript');
        const file=path.join(__dirname, '../js', path.basename(url.pathname));
        if(!fs.existsSync(file)){response.writeHead(404);response.end();return;}
        response.end(fs.readFileSync(file));
    } else if (url.pathname === '/dropdown_ui.html') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fs.readFileSync(path.join(__dirname,'dropdown_ui.html')));
    } else if (['camera.mjs','viewport.mjs'].some(name=>url.pathname==='/extensions/RuYi/compare/'+name)) {
        response.setHeader('Content-Type','text/javascript');response.end(fs.readFileSync(path.join(__dirname,'../js/compare',path.basename(url.pathname))));
    } else if (url.pathname === '/ruyi_nodes/loras') {
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({items:[{lora:'Portrait/example.safetensors',folder:'Portrait',model_name:'Portrait lighting',base_model:'SD3'},{lora:'Style/example.safetensors',folder:'Style',model_name:'Watercolor style',base_model:'SD3'}]}));
    } else if (url.pathname === '/settings_demo.html') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fs.readFileSync(path.join(__dirname,'runtime/settings_demo.html')));
    } else if (url.pathname === '/view') {
        const image = url.searchParams.get('filename');
        const colors = {'a.svg': '#edb44c', 'b.svg': '#56a6de', 'c.svg': '#8ab571','portrait.svg':'#ad83cf'};
        if (!colors[image]) {response.writeHead(404); response.end(); return;}
        response.setHeader('Content-Type', 'image/svg+xml');
        const width=image==='portrait.svg'?640:960,height=image==='portrait.svg'?960:640;
        response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${colors[image]}"/><circle cx="${width/2}" cy="${height/2}" r="180" fill="#fff" opacity=".35"/><path d="M0 ${height/2}h${width}M${width/2} 0v${height}" stroke="#fff" stroke-width="4"/><text x="36" y="70" font-size="46" font-family="sans-serif" fill="#182230">Fixture ${image[0].toUpperCase()}</text></svg>`);
    } else if (url.pathname === '/' || url.pathname === '/image_compare_ui.html') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(fs.readFileSync(path.join(__dirname, 'image_compare_ui.html')));
    } else {response.writeHead(404); response.end();}
}).listen(port, '127.0.0.1', () => console.log(`RuYi compare UI: http://127.0.0.1:${port}`));
