import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStations,normalizeRoute} from '../src/data/normalize.js';
const stop={stId:'101000052',stNm:'충무로역',arsId:'02151',tmX:'126.9917771969',tmY:'37.5612508237'};
const meta={datasetId:'test',source:'서울특별시',fetchedAt:'2026-09-30T00:00:00Z',coordinateSystem:'WGS84'};
test('preserves distinct IDs for same names, leading zero and known coordinates',()=>{
 const result=normalizeStations([stop,{...stop,stId:'101000053'}],meta);
 assert.equal(result.stops.length,2);assert.equal(result.stops[0].arsId,'02151');assert.equal(result.stops[0].lng,126.9917771969);
 assert.equal(result.fetchedAt,meta.fetchedAt);
});
test('empty dataset and unknown collection time stay explicit',()=>{
 assert.deepEqual(normalizeStations([],meta).stops,[]);
 assert.equal(normalizeStations([stop],{...meta,fetchedAt:undefined}).fetchedAt,null);
});
test('invalid coordinates, duplicate IDs and projected coordinates are rejected',()=>{
 for(const bad of [{...stop,tmX:''},{...stop,tmY:undefined},{...stop,tmX:'199273'},{...stop,stId:''}])assert.throws(()=>normalizeStations([bad],meta));
 assert.throws(()=>normalizeStations([stop,stop],meta));
 assert.throws(()=>normalizeStations([stop],{...meta,coordinateSystem:'GRS80'}));
});
test('route order is numeric and repeated stop visits remain',()=>{
 const result=normalizeRoute([{station:'a',seq:'10',direction:'종점'},{station:'a',seq:'2',direction:'기점'}],{...meta,routeId:'r'});
 assert.deepEqual(result.stops,[{stopId:'a',sequence:2,direction:'기점'},{stopId:'a',sequence:10,direction:'종점'}]);
 assert.throws(()=>normalizeRoute([{station:'a',seq:'0'}],{...meta,routeId:'r'}));
});
