// Cloudflare Worker: static files come from ./dist; only /config.json, /live/* and /records run code.
// Secrets (set with `wrangler secret put` or the dashboard): KAKAO_MAP_JS_KEY, SEOUL_BUS_SERVICE_KEY, TEAM_CODE.
import {toLiveBuses} from '../src/live.js';
import {validateRecord} from '../src/records.js';
const MAX_RECORDS=500;
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff',...extra}});
let allowed;

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/records')return records(request,env,url);
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

// Shared experiment records in KV: one key per set of conditions, the record itself in the key's metadata
// so a single list() returns everything. Anyone can read; adding and deleting need the team code when one is set.
async function records(request,env,url){
 const noStore={'Cache-Control':'no-store'};
 if(!env.RECORDS)return json(404,{error:'공유 저장소가 연결되지 않았습니다.'},noStore);
 if(request.method==='GET'){
  const {keys}=await env.RECORDS.list({prefix:'r:',limit:1000});
  const list=keys.filter(item=>item.metadata).map(item=>item.metadata).sort((a,b)=>a.savedAt.localeCompare(b.savedAt));
  return json(200,{shared:true,needsCode:Boolean(env.TEAM_CODE),records:list},noStore);
 }
 if(request.method!=='POST'&&request.method!=='DELETE')return new Response(null,{status:405});
 if(env.TEAM_CODE&&request.headers.get('x-team-code')!==env.TEAM_CODE)return json(401,{error:'팀 코드가 맞지 않습니다.'},noStore);
 if(request.method==='DELETE'){
  const key=url.searchParams.get('key')||'';
  if(!/^[0-9a-z-]{10,60}$/.test(key))return json(400,{error:'잘못된 기록 키입니다.'},noStore);
  await env.RECORDS.delete('r:'+key);
  return json(200,{deleted:key},noStore);
 }
 const body=await request.text();
 if(body.length>2000)return json(413,{error:'기록이 너무 큽니다.'},noStore);
 let saved;
 try{saved=validateRecord(JSON.parse(body));}catch{return json(400,{error:'기록 형식이 맞지 않습니다.'},noStore);}
 if(!(await env.RECORDS.getWithMetadata('r:'+saved.key)).metadata){
  const {keys}=await env.RECORDS.list({prefix:'r:',limit:1000});
  if(keys.length>=MAX_RECORDS)return json(409,{error:`기록이 ${MAX_RECORDS}건으로 가득 찼습니다. 필요 없는 기록을 지워 주세요.`},noStore);
 }
 await env.RECORDS.put('r:'+saved.key,'',{metadata:saved.record});
 return json(200,saved,noStore);
}
