import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../scripts/server.mjs';
import {collect} from '../scripts/collect.mjs';
test('API missing key, agency error and network failure are explicit and do not leak key',async()=>{
 await assert.rejects(()=>collect('route','100100118',{key:''}));
 await assert.rejects(()=>collect('route','100100118',{key:'secret',fetchImpl:async()=>({ok:true,text:async()=>'<headerCd>7</headerCd>'})}),/기관 오류/);
 await assert.rejects(()=>collect('route','100100118',{key:'secret',fetchImpl:async()=>{throw new Error('secret');}}),e=>!e.message.includes('secret'));
});
test('API uses official method and exactly one encoding',async()=>{
 const xml=await collect('stations','충무로',{key:'abc+/',fetchImpl:async url=>{
  assert.equal(url.searchParams.get('serviceKey'),'abc+/');assert.equal(url.searchParams.get('stSrch'),'충무로');
  assert.equal(url.pathname,'/api/rest/stationinfo/getStationByName');
  return {ok:true,text:async()=>'<ServiceResult><headerCd>0</headerCd></ServiceResult>'};
 }});
 assert.ok(xml.includes('ServiceResult'));
});
test('local server serves UI but denies secrets, legacy and traversal',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/src/simulation.js')).status,200);
  for(const p of ['/.env','/.git/config','/legacy/prototype.py','/public/%2e%2e/.env'])assert.equal((await fetch(base+p)).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
test('public configuration contains only the browser map key',async()=>{
 const server=createServer(undefined,{kakaoJsKey:'browser-key',serviceKey:'private-key'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const res=await fetch('http://127.0.0.1:'+server.address().port+'/config.json');
  assert.equal(res.status,200);assert.deepEqual(await res.json(),{kakaoJsKey:'browser-key'});
 }finally{await new Promise(r=>server.close(r));}
});
test('JSON collection checks agency status and sets resultType',async()=>{
 const response=await collect('stations','충무로',{key:'secret',format:'json',fetchImpl:async url=>{
  assert.equal(url.searchParams.get('resultType'),'json');
  return {ok:true,text:async()=>JSON.stringify({msgHeader:{headerCd:'0'},msgBody:{itemList:[]}})};
 }});
 assert.deepEqual(response.msgBody.itemList,[]);
 await assert.rejects(()=>collect('stations','충무로',{key:'secret',format:'json',fetchImpl:async()=>({ok:true,text:async()=>'{"msgHeader":{"headerCd":"7"}}'})}),/기관 오류/);
});

test('live position proxy only serves collected routes, strips the key and caches',async()=>{
 const {mkdtemp,mkdir,writeFile}=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');
 const root=await mkdtemp(path.join(os.tmpdir(),'bro-'));await mkdir(path.join(root,'data/public'),{recursive:true});
 await writeFile(path.join(root,'data/public/routes.json'),JSON.stringify({routes:[{id:'100100063'}]}));
 let calls=0;
 const server=createServer(root,{fetchPositions:async()=>{calls++;return {msgBody:{itemList:[{vehId:'1',plainNo:'서울70사1',gpsX:'127.0',gpsY:'37.5',dataTm:'20260930103612',stopFlag:'0'}]}};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/live/buspos?routeId=999999999')).status,404);
  const first=await (await fetch(base+'/live/buspos?routeId=100100063')).json();
  await fetch(base+'/live/buspos?routeId=100100063');
  assert.deepEqual(first.buses,[{vehId:'1',plainNo:'서울70사1',lat:37.5,lng:127,dataTm:'20260930103612',stopFlag:false}]);
  assert.equal(calls,1);assert.ok(!JSON.stringify(first).includes('serviceKey'));
  assert.equal(first.callsToday,1);
 }finally{await new Promise(r=>server.close(r));}
});
test('live proxy stops at the daily limit instead of calling the agency',async()=>{
 const {mkdtemp,mkdir,writeFile}=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');
 const root=await mkdtemp(path.join(os.tmpdir(),'bro-'));await mkdir(path.join(root,'data/public'),{recursive:true});
 await writeFile(path.join(root,'data/public/routes.json'),JSON.stringify({routes:[{id:'1'},{id:'2'}]}));
 let calls=0;
 const server=createServer(root,{liveDailyLimit:1,fetchPositions:async()=>{calls++;return {msgBody:{itemList:[]}};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/live/buspos?routeId=1')).status,200);
  const blocked=await fetch(base+'/live/buspos?routeId=2');
  assert.equal(blocked.status,429);assert.equal((await blocked.json()).callsToday,1);assert.equal(calls,1);
 }finally{await new Promise(r=>server.close(r));}
});
