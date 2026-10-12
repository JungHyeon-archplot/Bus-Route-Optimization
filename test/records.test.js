import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord,recordKey} from '../src/records.js';
const good={arsId:'02151',stopName:'충무로역.한옥마을.한국의집',rule:'single',timing:'random',dwell:40,seed:1,minShared:3,berths:1,hours:2,served:111,waited:65,totalWait:2050,maxQueue:3,linkedShare:57,by:' 정현 ',extra:'<script>'};
test('a valid record is rebuilt field by field: server time, trimmed name, no extra fields',()=>{
 const {key,record}=validateRecord(good,new Date('2026-09-30T06:00:00Z'));
 assert.equal(key,'02151-single-random-40-1-3');assert.equal(key,recordKey(record));
 assert.equal(record.savedAt,'2026-09-30T06:00:00.000Z');assert.equal(record.by,'정현');assert.ok(!('extra' in record));
 assert.equal(validateRecord({...good,linkedShare:null,by:undefined}).record.by,'');
});
test('bad or oversized values are rejected',()=>{
 for(const bad of [null,{...good,arsId:'2151'},{...good,rule:'skip'},{...good,timing:'x'},{...good,dwell:40.5},{...good,seed:0},{...good,waited:200},
  {...good,totalWait:-1},{...good,stopName:'x'.repeat(41)},{...good,stopName:''},{...good,linkedShare:101},{...good,served:'111'}])assert.throws(()=>validateRecord(bad));
});
