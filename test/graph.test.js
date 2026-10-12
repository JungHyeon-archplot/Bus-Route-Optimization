import test from 'node:test';
import assert from 'node:assert/strict';
import {postmanExample} from '../src/scenario.js';
import {shortestPath,chinesePostman,colorGraph} from '../src/graph.js';
test('shortest path picks AC=3 instead of AB+BC=4',()=>assert.deepEqual(shortestPath(postmanExample,'A','C').vertices,['A','C']));
test('postman gives 22 and traverses every edge with a connected closed tour',()=>{
 const r=chinesePostman(postmanExample);assert.equal(r.totalCost,22);assert.equal(r.extraCost,3);
 assert.equal(r.tour[0],r.tour.at(-1));assert.equal(r.tour.length,r.traversedEdges.length+1);
 let cost=0;for(let i=0;i<r.traversedEdges.length;i++){const e=postmanExample.find(e=>e.id===r.traversedEdges[i]);assert.ok([e.from,e.to].includes(r.tour[i])&&[e.from,e.to].includes(r.tour[i+1]));cost+=e.weight;}
 assert.equal(cost,22);for(const e of postmanExample)assert.ok(r.traversedEdges.includes(e.id));
});
test('postman handles four odd vertices with global matching',()=>{
 const edges=[['A','B',2],['A','C',3],['A','D',4]].map(([from,to,weight],i)=>({id:i,from,to,weight}));
 assert.equal(chinesePostman(edges).totalCost,18);
});
test('reject disconnected and negative input',()=>{
 assert.throws(()=>chinesePostman([{id:0,from:'A',to:'B',weight:1},{id:1,from:'C',to:'D',weight:1}]));
 assert.throws(()=>shortestPath([{id:0,from:'A',to:'B',weight:-1}],'A','B'));
});
test('K5 is not forced into four colors',()=>{
 const nodes=['a','b','c','d','e'],edges=nodes.flatMap((n,i)=>nodes.slice(i+1).map(v=>[n,v]));
 const r=colorGraph(nodes,edges);assert.equal(r.count,5);edges.forEach(([a,b])=>assert.notEqual(r.colors[a],r.colors[b]));
});

