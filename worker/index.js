// Cloudflare Worker: static files come from ./dist; only /config.json, /live/* and /records run code.
// Secrets (set with `wrangler secret put` or the dashboard): KAKAO_MAP_JS_KEY, SEOUL_BUS_SERVICE_KEY, TEAM_CODE.
import {toLiveBuses} from '../src/live.js';
import {validateRecord} from '../src/records.js';
const MAX_RECORDS=5000;
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

// Shared experiment records in D1. Every record is a new row (nothing is overwritten) and deleting only marks the
// row, so the team history stays. Anyone can read; adding and deleting need the team code when one is set.
async function records(request,env,url){
 const noStore={'Cache-Control':'no-store'};
 if(!env.DB)return json(404,{error:'공유 저장소가 연결되지 않았습니다.'},noStore);
 if(request.method==='GET'){
  const {results}=await env.DB.prepare('SELECT id, data FROM records WHERE deleted_at IS NULL ORDER BY id').all();
  return json(200,{shared:true,needsCode:Boolean(env.TEAM_CODE),records:results.map(row=>({...JSON.parse(row.data),id:row.id}))},noStore);
 }
 if(request.method!=='POST'&&request.method!=='DELETE')return new Response(null,{status:405});
 if(env.TEAM_CODE&&request.headers.get('x-team-code')!==env.TEAM_CODE)return json(401,{error:'팀 코드가 맞지 않습니다.'},noStore);
 if(request.method==='DELETE'){
  const id=Number(url.searchParams.get('id'));
  if(!Number.isInteger(id)||id<1)return json(400,{error:'잘못된 기록 번호입니다.'},noStore);
  await env.DB.prepare('UPDATE records SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').bind(new Date().toISOString(),id).run();
  return json(200,{deleted:id},noStore);
 }
 const body=await request.text();
 if(body.length>2000)return json(413,{error:'기록이 너무 큽니다.'},noStore);
 let saved;
 try{saved=validateRecord(JSON.parse(body));}catch{return json(400,{error:'기록 형식이 맞지 않습니다.'},noStore);}
 const {count}=await env.DB.prepare('SELECT COUNT(*) AS count FROM records').first();
 if(count>=MAX_RECORDS)return json(409,{error:`기록이 ${MAX_RECORDS}건으로 가득 찼습니다.`},noStore);
 const row=await env.DB.prepare('INSERT INTO records (saved_at, data) VALUES (?, ?) RETURNING id').bind(saved.record.savedAt,JSON.stringify(saved.record)).first();
 return json(200,{record:{...saved.record,id:row.id}},noStore);
}
