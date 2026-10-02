// Local-only fixture server: node tests/serve_image_compare_ui.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const appStub = `export const app = {
    extensions: [], graph: {_nodes: [], change() {}},
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
    } else if (url.pathname === '/extensions/RuYi/ruyi_image_compare.js' || url.pathname === '/extensions/RuYi/theme.mjs') {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(fs.readFileSync(path.join(__dirname, '../js', path.basename(url.pathname))));
    } else if (url.pathname === '/view') {
        const image = url.searchParams.get('filename');
        const colors = {'a.svg': '#edb44c', 'b.svg': '#56a6de', 'c.svg': '#8ab571'};
        if (!colors[image]) {response.writeHead(404); response.end(); return;}
        response.setHeader('Content-Type', 'image/svg+xml');
        response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="${colors[image]}"/><circle cx="480" cy="320" r="180" fill="#fff" opacity=".35"/><path d="M0 320h960M480 0v640" stroke="#fff" stroke-width="4"/><text x="36" y="70" font-size="46" font-family="sans-serif" fill="#182230">Fixture ${image[0].toUpperCase()}</text></svg>`);
    } else if (url.pathname === '/' || url.pathname === '/image_compare_ui.html') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(fs.readFileSync(path.join(__dirname, 'image_compare_ui.html')));
    } else {response.writeHead(404); response.end();}
}).listen(port, '127.0.0.1', () => console.log(`RuYi compare UI: http://127.0.0.1:${port}`));
