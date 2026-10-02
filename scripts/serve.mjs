import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('src');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let target=path.resolve(root,'.'+name);
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  if((await stat(target)).isDirectory()){
   if(!name.endsWith('/')){res.writeHead(301,{Location:name+'/'});res.end();return;}
   target=path.join(target,'index.html');
  }
  const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(5173,'127.0.0.1',()=>console.log('Liquid Type: http://127.0.0.1:5173 — MS: http://127.0.0.1:5173/MS/ — reload after edits.'));
