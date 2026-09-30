import test from 'node:test';
import assert from 'node:assert/strict';
import {conflictGraph,colorGraph} from '../src/coloring.js';
import {arrivals,simulateStop,compareBerths} from '../src/berth.js';
const node=id=>({id});
test('coloring is exact: K5 needs five colors, a 5-cycle needs three, no edge shares a color',()=>{
 const ids=['a','b','c','d','e'],k5=[];
 for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)k5.push({a:ids[i],b:ids[j]});
 assert.equal(colorGraph(ids.map(node),k5).colors,5);
 const cycle=ids.map((id,i)=>({a:id,b:ids[(i+1)%5]})),result=colorGraph(ids.map(node),cycle);
 assert.equal(result.colors,3);
 for(const {a,b} of cycle)assert.notEqual(result.assignment[a],result.assignment[b]);
 assert.deepEqual(colorGraph([],[]),{colors:0,assignment:{}});
});
test('conflict graph uses shared corridor stops and drops night/tour routes',()=>{
 const r=(id,typeCode='3')=>({id,name:id,typeCode,termMinutes:10});
 const dataset={routes:[r('x'),r('y'),r('z'),r('n','15')],stops:[
  {arsId:'1',routes:['x','y','z','n']},{arsId:'2',routes:['x','y','n']},{arsId:'3',routes:['x','y']},{arsId:'4',routes:['z']}]};
 const g=conflictGraph(dataset,'1',{minShared:3});
 assert.deepEqual(g.nodes.map(n=>n.id),['x','y','z']);
 assert.deepEqual(g.edges,[{a:'x',b:'y',shared:3}]);
});
test('same arrivals: every bus is served in every rule, results are seed-reproducible',()=>{
 const routes=[{id:'a',termMinutes:5},{id:'b',termMinutes:5},{id:'c',termMinutes:7}];
 assert.deepEqual(arrivals(routes,{seed:7}),arrivals(routes,{seed:7}));
 const result=compareBerths(routes,{a:0,b:1,c:0},2,{seed:7});
 for(const rule of ['single','pooled','colored'])assert.equal(result[rule].served,result.arrivals);
 assert.ok(result.pooled.meanWait<=result.single.meanWait);
});
test('two buses at once on one berth: the second waits one dwell',()=>{
 const r=simulateStop([{route:'a',time:0},{route:'b',time:0}],{berths:1,dwell:25});
 assert.deepEqual(r.events.map(e=>e.wait),[0,25]);assert.equal(r.maxQueue,1);
});
