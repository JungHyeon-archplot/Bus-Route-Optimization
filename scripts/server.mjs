import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {request} from './collect.mjs';
export function createServer(root=fileURLToPath(new URL('../',import.meta.url)),{kakaoJsKey=process.env.KAKAO_MAP_JS_KEY||'',fetchPositions=routeId=>request('buspos/getBusPosByRtid',{busRouteId:routeId})}={}) {
  const liveCache=new Map(); // routeId → {at, body}; 30 s keeps a page left open far under the 1,000/day quota
  let allowed;
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
  return http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
    if(pathname==='/config.json'){
      res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end(req.method==='HEAD'?undefined:JSON.stringify({kakaoJsKey}));
    }
    if(pathname==='/live/buspos'){
      const routeId=new URL(req.url,'http://localhost').searchParams.get('routeId')||'';
      allowed??=new Set(JSON.parse(await readFile(path.join(root,'data/public/routes.json'),'utf8').catch(()=>'{"routes":[]}')).routes.map(route=>route.id));
      const json=(code,body)=>{res.writeHead(code,{'Content-Type':mime['.json'],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:JSON.stringify(body));};
      if(!allowed.has(routeId))return json(404,{error:'수집한 노선만 조회할 수 있습니다.'});
      const hit=liveCache.get(routeId);
      if(hit&&Date.now()-hit.at<30000)return json(200,hit.body);
      try{
        const response=await fetchPositions(routeId);
        const buses=(response.msgBody?.itemList??[]).map(item=>({vehId:item.vehId,plainNo:item.plainNo,lat:Number(item.gpsY),lng:Number(item.gpsX),dataTm:item.dataTm,stopFlag:item.stopFlag==='1'}))
          .filter(bus=>Number.isFinite(bus.lat)&&Number.isFinite(bus.lng));
        const body={routeId,fetchedAt:new Date().toISOString(),buses};
        liveCache.set(routeId,{at:Date.now(),body});return json(200,body);
      }catch(error){return json(502,{error:'서울시 버스위치 API 응답을 받지 못했습니다.'});}
    }
    const file=pathname==='/'?'public/index.html':
      pathname==='/stations.json'?'data/public/stations.json':
      pathname==='/routes.json'?'data/public/routes.json':
      pathname==='/hub-models.json'?'data/reference/hub-models.json':
      /^\/(?:public|src)\/[A-Za-z0-9_-]+\.(?:js|css)$/.test(pathname)?pathname.slice(1):null;
    if(!file){res.writeHead(404);return res.end('Not found');}
    try {
      const data=await readFile(path.join(root,file));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)],'X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"upgrade-insecure-requests; default-src 'self'; script-src 'self' https://dapi.kakao.com https://t1.daumcdn.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.daumcdn.net https://*.kakaocdn.net; connect-src 'self' https://dapi.kakao.com; object-src 'none'; frame-ancestors 'none'",
        'Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080);
  createServer().listen(port,'127.0.0.1',()=>console.log('Open http://localhost:'+port));
}
