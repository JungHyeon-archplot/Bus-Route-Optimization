import test from 'node:test';
import assert from 'node:assert/strict';
import {voronoiCells} from '../src/voronoi.js';
const bounds={minX:0,minY:0,maxX:4,maxY:4};
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2);
test('two sites split at their perpendicular bisector and preserve total area',()=>{
 const cells=voronoiCells([{id:'a',x:0,y:2},{id:'b',x:2,y:2}],bounds);
 assert.ok(cells[0].polygon.every(p=>p.x<=1+1e-9));
 assert.ok(cells[1].polygon.every(p=>p.x>=1-1e-9));
 assert.equal(area(cells[0].polygon),4);assert.equal(area(cells[1].polygon),12);
});
test('collinear sites and order changes preserve cells',()=>{
 const points=[{id:'a',x:0,y:2},{id:'b',x:2,y:2},{id:'c',x:4,y:2}];
 const a=voronoiCells(points,bounds),b=voronoiCells([...points].reverse(),bounds);
 for(const cell of a)assert.equal(area(cell.polygon),area(b.find(c=>c.id===cell.id).polygon));
 assert.equal(a.reduce((s,c)=>s+area(c.polygon),0),16);
});
test('duplicates, nonfinite sites and invalid bounds fail explicitly',()=>{
 assert.throws(()=>voronoiCells([{id:'a',x:1,y:1},{id:'b',x:1,y:1}],bounds));
 assert.throws(()=>voronoiCells([{id:'a',x:NaN,y:1}],bounds));
 assert.throws(()=>voronoiCells([],{...bounds,maxX:0}));
 assert.deepEqual(voronoiCells([],bounds),[]);
});
