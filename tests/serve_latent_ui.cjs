const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const stub = `export const app = {extensions:[], extensionManager:{setting:{get(){return document.documentElement.lang;}}}, registerExtension(ext){this.extensions.push(ext);}};`;
http.createServer((request,response)=>{
    const url = new URL(request.url,'http://127.0.0.1');
    if(url.pathname==='/scripts/app.js'){response.setHeader('Content-Type','text/javascript');response.end(stub);return;}
    let file = path.join(__dirname,url.pathname==='/layout_demo.html'?'runtime/latent-layout-demo.html':'latent_ui.html');
    if(url.pathname.startsWith('/extensions/RuYi/')){
        file=path.resolve(root,'js',url.pathname.slice('/extensions/RuYi/'.length));
        if(!file.startsWith(path.join(root,'js')+path.sep)){response.writeHead(403);response.end();return;}
        response.setHeader('Content-Type','text/javascript');
    }else response.setHeader('Content-Type','text/html');
    if(!fs.existsSync(file)){response.writeHead(404);response.end('Missing latent node');return;}
    response.end(fs.readFileSync(file));
}).listen(8202,'127.0.0.1',()=>console.log('Latent UI: http://127.0.0.1:8202'));
