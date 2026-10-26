import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeObservation} from '../src/observation.js';
test('gaps, per-route headways and the random-arrival baseline',()=>{
 const at=m=>new Date(Date.UTC(2026,8,30,2,0)+m*60000).toISOString();
 const obs={startedAt:at(0),endedAt:at(40),routes:[{name:'421',termMinutes:9},{name:'463',termMinutes:10}],
  passes:[{route:'421',time:at(1)},{route:'463',time:at(1.5)},{route:'421',time:at(10)},{route:'463',time:at(21)}]};
 const s=summarizeObservation(obs);
 assert.equal(s.passes,4);assert.deepEqual(s.gaps,[30,510,660]);assert.equal(s.within,1);
 assert.deepEqual(s.byRoute['421'].headways,[9]);assert.deepEqual(s.byRoute['463'].headways,[19.5]);
 assert.ok(Math.abs(s.expectedShare-(1-Math.exp(-4/2400*60)))<1e-12);
});
