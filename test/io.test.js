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

