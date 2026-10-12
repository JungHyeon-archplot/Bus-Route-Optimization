import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRoutesAtStop} from '../src/data/normalize.js';
import {overlapSummary} from '../src/network.js';
test('routes at a stop keep IDs, nominal headway and unknown type codes explicit',()=>{
 const [a,b]=normalizeRoutesAtStop([{busRouteId:'100100063',busRouteNm:'421',busRouteType:'3',term:'9',stBegin:'염곡동',stEnd:'옥수동'},{busRouteId:'1',busRouteNm:'N16',busRouteType:'15',term:''}]);
 assert.deepEqual(a,{id:'100100063',name:'421',type:'간선',typeCode:'3',termMinutes:9,start:'염곡동',end:'옥수동'});
 assert.equal(b.type,'미상');assert.equal(b.termMinutes,null);
 assert.throws(()=>normalizeRoutesAtStop([{busRouteNm:'x'}]));
});
test('overlap counts each shared stop once per route pair and ranks busy stops',()=>{
 const r=(id,name)=>({id,name});
 const dataset={routes:[r('1','421'),r('2','463'),r('3','507')],stops:[
  {arsId:'02151',routes:['1','2','3']},{arsId:'02154',routes:['2','1','1']},{arsId:'02153',routes:['3']},{arsId:'09999',routes:[]}]};
 const {busiestStops,sharedPairs}=overlapSummary(dataset);
 assert.deepEqual(busiestStops.map(x=>x.stop.arsId),['02151','02154','02153']);
 assert.deepEqual(sharedPairs.map(p=>[p.a.name,p.b.name,p.sharedStops]),[['421','463',2],['421','507',1],['463','507',1]]);
});
