// Cloudflare Worker: static files come from ./dist; only these two paths run code.
// Secrets (set with `wrangler secret put` or the dashboard): KAKAO_MAP_JS_KEY, SEOUL_BUS_SERVICE_KEY.
import {toLiveBuses} from '../src/live.js';
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff',...extra}});
let allowed;

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405});
  if(url.pathname==='/config.json')return json(200,{kakaoJsKey:env.KAKAO_MAP_JS_KEY||''},{'Cache-Control':'no-store'});
  if(url.pathname==='/live/buspos'){
   const routeId=url.searchParams.get('routeId')||'';
   allowed??=new Set((await (await env.ASSETS.fetch(new URL('/routes.json',url))).json()).routes.map(route=>route.id));
   if(!allowed.has(routeId))return json(404,{error:'수집한 노선만 조회할 수 있습니다.'});
   // Vehicles report about every 20 s; a shared 10 s edge cache keeps many viewers to one agency call.
   const cacheKey=new Request(`${url.origin}/live/buspos?routeId=${routeId}`);
   const hit=await caches.default.match(cacheKey);
   if(hit)return hit;
   if(!env.SEOUL_BUS_SERVICE_KEY)return json(503,{error:'서버에 서울시 인증키가 설정되지 않았습니다.'});
   // ponytail: no daily counter here (would need KV/Durable Object); the edge cache and the agency's own 1,000/day limit bound usage.
   const api=new URL('http://ws.bus.go.kr/api/rest/buspos/getBusPosByRtid');
   api.searchParams.set('serviceKey',env.SEOUL_BUS_SERVICE_KEY);api.searchParams.set('busRouteId',routeId);api.searchParams.set('resultType','json');
   try{
    const upstream=await fetch(api,{signal:AbortSignal.timeout(10000)});
    const data=await upstream.json();
    if(String(data.msgHeader?.headerCd)!=='0'&&String(data.msgHeader?.headerCd)!=='4')return json(502,{error:'서울시 API가 오류를 돌려줬습니다. 호출 한도나 인증키를 확인하세요.'});
    const response=json(200,toLiveBuses(routeId,data),{'Cache-Control':'public, max-age=10'});
    ctx.waitUntil(caches.default.put(cacheKey,response.clone()));
    return response;
   }catch{return json(502,{error:'서울시 버스위치 API 응답을 받지 못했습니다.'});}
  }
  return env.ASSETS.fetch(request);
 }
};
