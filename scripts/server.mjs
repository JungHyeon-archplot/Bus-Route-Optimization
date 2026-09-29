import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function createServer(root=fileURLToPath(new URL('../',import.meta.url))) {
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  return http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
    const file=pathname==='/'?'public/index.html':
      /^\/(?:public|src)\/[A-Za-z0-9_-]+\.(?:js|css)$/.test(pathname)?pathname.slice(1):null;
    if(!file){res.writeHead(404);return res.end('Not found');}
    try {
      const data=await readFile(path.join(root,file));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)],'X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
        'Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080);
  createServer().listen(port,'127.0.0.1',()=>console.log('Open http://localhost:'+port));
}

