import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {request} from './collect.mjs';
import {CSP,toLiveBuses} from '../src/live.js';
export function createServer(root=fileURLToPath(new URL('../',import.meta.url)),{kakaoJsKey=process.env.KAKAO_MAP_JS_KEY||'',fetchPositions=routeId=>request('buspos/getBusPosByRtid',{busRouteId:routeId}),liveDailyLimit=Number(process.env.LIVE_DAILY_LIMIT||950)}={}) {
  // Seoul vehicles report about every 20 s, so a 9 s cache loses nothing. The dev key allows 1,000 calls/day per function;
  // count them per KST day and stop before the agency does.
  // ponytail: in-memory count resets on restart; persist to data/private if the server restarts often in one day.
  const liveCache=new Map(),usage={day:'',calls:0};
  const today=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
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
      if(usage.day!==today()){usage.day=today();usage.calls=0;}
      const quota=()=>({callsToday:usage.calls,dailyLimit:liveDailyLimit});
      const hit=liveCache.get(routeId);
      if(hit&&Date.now()-hit.at<9000)return json(200,{...hit.body,...quota()});
      if(usage.calls>=liveDailyLimit)return json(429,{error:'오늘 실시간 위치 호출 한도에 가까워 멈췄습니다. 내일 다시 켜지거나, 운영계정 트래픽을 늘려야 합니다.',...quota()});
      try{
        usage.calls++;
        const response=await fetchPositions(routeId);
        const body=toLiveBuses(routeId,response);
        liveCache.set(routeId,{at:Date.now(),body});return json(200,{...body,...quota()});
      }catch(error){return json(502,{error:'서울시 버스위치 API 응답을 받지 못했습니다.'});}
    }
    const file=pathname==='/'?'public/index.html':
      pathname==='/stations.json'?'data/public/stations.json':
      pathname==='/routes.json'?'data/public/routes.json':
      pathname==='/observation.json'?'data/public/observations/latest.json':
      pathname==='/hub-models.json'?'data/reference/hub-models.json':
      /^\/(?:public|src)\/[A-Za-z0-9_-]+\.(?:js|css)$/.test(pathname)?pathname.slice(1):null;
    if(!file){res.writeHead(404);return res.end('Not found');}
    try {
      const data=await readFile(path.join(root,file));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)],'X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':CSP,
        'Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080);
  createServer().listen(port,'127.0.0.1',()=>console.log('Open http://localhost:'+port));
}
