const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');let file;
 if(url.pathname==='/scripts/app.js'){res.setHeader('Content-Type','text/javascript');res.end('export const app={extensions:[],graph:{setDirtyCanvas(){}},registerExtension(e){this.extensions.push(e)},extensionManager:{setting:{get(){return "zh"}}}};');return;}
 if(url.pathname==='/ruyi_nodes/prompt/vocabulary'){file=path.join(root,'data/prompt/vocabulary.json.gz');res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Type','application/json');}
 else if(url.pathname.startsWith('/extensions/RuYi-Nodes/')){file=path.join(root,'js',url.pathname.slice('/extensions/RuYi-Nodes/'.length));res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':'text/plain');}
 else{file=path.join(__dirname,'prompt_ui.html');res.setHeader('Content-Type','text/html');}
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}fs.createReadStream(file).pipe(res);
}).listen(8201,'127.0.0.1',()=>console.log('Prompt UI tests http://127.0.0.1:8201'));
