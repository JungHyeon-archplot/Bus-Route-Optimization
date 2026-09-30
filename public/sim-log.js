import {summarizeLog} from '/src/routesim.js';
const $=id=>document.getElementById(id);
const clock=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const secs=value=>value<1?'0초':value<60?`${Math.round(value)}초`:`${Math.floor(value/60)}분 ${Math.round(value%60)}초`;
const RULES={single:'설 자리 1곳',pooled:'빈 곳 아무 데나',colored:'노선별 지정'};
let lastRuns,lastCtx,shown=0;

function cells(row,values){for(const value of values){const td=document.createElement('td');td.textContent=value;row.append(td);}}

// 2-hour log of the rule shown on the map: where the waiting came from.
export function renderLog(runs,ctx){
 lastRuns=runs;lastCtx=ctx;
 const current=runs.find(run=>run.key===ctx.rule),{byRoute,pairs}=summarizeLog(current.s.log);
 const total=pairs.reduce((sum,pair)=>sum+pair.totalWait,0);
 const linked=pairs.filter(pair=>ctx.linked(pair.blocker,pair.blocked)).reduce((sum,pair)=>sum+pair.totalWait,0);
 $('log-share').textContent=total<1
  ?`${RULES[ctx.rule]}: 2시간 동안 기다린 버스가 없습니다.`
  :`${RULES[ctx.rule]}: 기다린 시간 ${secs(total)} 중 ${Math.round(linked/total*100)}%가 '함께 달리는'(그래프로 이어진) 노선 쌍 사이에서, 나머지는 이어지지 않은 쌍 사이에서 생겼습니다.`;
 const pairBody=$('log-pairs');pairBody.replaceChildren();
 for(const pair of pairs.slice(0,8)){const tr=document.createElement('tr');cells(tr,[`${ctx.name(pair.blocker)} → ${ctx.name(pair.blocked)}`,`${pair.count}번`,secs(pair.totalWait),ctx.linked(pair.blocker,pair.blocked)?'예':'아니오']);pairBody.append(tr);}
 if(!pairs.length){const tr=document.createElement('tr');cells(tr,['기다린 경우 없음','','','']);pairBody.append(tr);}
 const routeBody=$('log-routes');routeBody.replaceChildren();
 for(const [id,r] of Object.entries(byRoute).sort((a,b)=>b[1].totalWait-a[1].totalWait)){const tr=document.createElement('tr');cells(tr,[ctx.name(id),`${r.arrivals}대`,`${r.waited}대`,secs(r.totalWait)]);routeBody.append(tr);}
}

// Waits that happen on the map right now, newest first.
export function resetLiveLog(){shown=0;$('log-live').replaceChildren();}
export function updateLiveLog(sim,ctx){
 const list=$('log-live');
 for(;shown<sim.log.length;shown++){
  const entry=sim.log[shown];
  if(entry.wait<=0.5)continue;
  const li=document.createElement('li');
  li.textContent=`${clock(entry.arrival)}  ${ctx.name(entry.route)}번(${entry.vehicle}호차)이 ${entry.blockedBy?ctx.name(entry.blockedBy)+'번 뒤에서 ':''}${secs(entry.wait)} 기다림 · 자리 ${String.fromCharCode(65+entry.berth)}${entry.queueOnArrival?` · 앞 줄 ${entry.queueOnArrival}대`:''}`;
  list.prepend(li);
  while(list.children.length>40)list.lastChild.remove();
 }
}

// One CSV with every bus under all three rules, so the rules can be compared outside the page.
function download(){
 if(!lastRuns)return;
 const ctx=lastCtx,head=['정류장','서는 방식','버스 오는 시점','정차(초)','설 자리 수','seed','도착(초)','도착(분:초)','노선','차량','자리','도착 때 앞 줄(대)','기다린 시간(초)','앞에 있던 노선','함께 달리는 쌍'];
 const rows=[head];
 for(const {key,s} of lastRuns)for(const entry of s.log)rows.push([
  ctx.stopName,RULES[key],ctx.timing==='spread'?'노선끼리 간격 두기':'제각각',ctx.dwell,key==='single'?1:ctx.colors,ctx.seed,
  entry.arrival,clock(entry.arrival),ctx.name(entry.route),entry.vehicle,String.fromCharCode(65+entry.berth),entry.queueOnArrival,Math.round(entry.wait*10)/10,
  entry.blockedBy?ctx.name(entry.blockedBy):'',entry.blockedBy?(ctx.linked(entry.blockedBy,entry.route)?'예':'아니오'):'']);
 saveCsv(`정류장기록_${ctx.arsId}_${ctx.timing}_${ctx.dwell}초_seed${ctx.seed}.csv`,rows);
}
$('log-download').addEventListener('click',download);

function saveCsv(name,rows){
 const csv='\uFEFF'+rows.map(row=>row.map(value=>/[",\n]/.test(String(value))?`"${String(value).replace(/"/g,'""')}"`:value).join(',')).join('\r\n');
 const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download=name;link.click();URL.revokeObjectURL(link.href);
}

// ---- Experiment records: one row per recorded run, kept in this browser, so conditions can be compared later. ----
const KEY='bus-sim-records-v1';
const TIMING={random:'제각각',spread:'간격 두기'};
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))??[];}catch{return [];}};
let memory=load();
const save=records=>{memory=records;try{localStorage.setItem(KEY,JSON.stringify(records));}catch{/* storage blocked: keep for this page only */}};
const same=(a,b)=>['arsId','rule','timing','dwell','seed','minShared'].every(k=>a[k]===b[k]);

function renderRecords(){
 const list=$('record-list'),max=Math.max(1,...memory.map(record=>record.totalWait));
 list.replaceChildren();
 $('record-count').textContent=memory.length?`${memory.length}건`:'';
 if(!memory.length){const li=document.createElement('li');li.className='empty';li.textContent='아직 기록이 없습니다. 조건을 고르고 "지금 조건의 결과 기록하기"를 누르세요.';list.append(li);return;}
 memory.forEach((record,index)=>{
  const li=document.createElement('li'),head=document.createElement('div'),name=document.createElement('span'),value=document.createElement('b'),track=document.createElement('div'),fill=document.createElement('i'),meta=document.createElement('small'),remove=document.createElement('button');
  name.textContent=`${index+1}. ${RULES[record.rule]}${record.rule==='single'?'':` ${record.berths}곳`} · ${TIMING[record.timing]} · ${record.dwell}초`;
  value.textContent=secs(record.totalWait);head.append(name,value);
  track.className='track';fill.style.width=(record.totalWait/max*100)+'%';track.append(fill);
  meta.textContent=`${record.stopName} · ${record.served}대 중 ${record.waited}대 기다림 · 긴 줄 ${record.maxQueue}대 · seed ${record.seed} · 기준 ${record.minShared}곳`;
  remove.type='button';remove.className='remove';remove.textContent='지우기';remove.setAttribute('aria-label',`${index+1}번 기록 지우기`);
  remove.addEventListener('click',()=>{save(memory.filter(item=>item!==record));renderRecords();});
  li.append(head,track,meta,remove);list.append(li);
 });
}

$('record-add').addEventListener('click',()=>{
 if(!lastRuns)return;
 const ctx=lastCtx,{s}=lastRuns.find(run=>run.key===ctx.rule),pairs=summarizeLog(s.log).pairs;
 const total=pairs.reduce((sum,pair)=>sum+pair.totalWait,0),linked=pairs.filter(pair=>ctx.linked(pair.blocker,pair.blocked)).reduce((sum,pair)=>sum+pair.totalWait,0);
 const record={savedAt:new Date().toISOString(),arsId:ctx.arsId,stopName:ctx.stopName,rule:ctx.rule,timing:ctx.timing,dwell:ctx.dwell,seed:ctx.seed,minShared:ctx.minShared,
  berths:ctx.rule==='single'?1:ctx.colors,hours:2,served:s.served,waited:s.waited,totalWait:Math.round(s.totalWait),maxQueue:s.maxQueue,linkedShare:total?Math.round(linked/total*100):null};
 // Re-recording the same conditions replaces the old row instead of piling up duplicates.
 save([...memory.filter(item=>!same(item,record)),record]);renderRecords();
});
$('record-csv').addEventListener('click',()=>{
 if(!memory.length)return;
 saveCsv('실험기록.csv',[['기록 시각','정류장','ARS','서는 방식','설 자리 수','버스 오는 시점','정차(초)','seed','함께 달림 기준(공유 정류장)','모의 시간(시간)','정차한 버스','기다린 버스','기다린 시간 합(초)','기다린 버스 평균 대기(초)','가장 긴 줄','이어진 쌍에서 생긴 대기(%)'],
  ...memory.map(r=>[new Date(r.savedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),r.stopName,r.arsId,RULES[r.rule],r.berths,TIMING[r.timing],r.dwell,r.seed,r.minShared,r.hours,r.served,r.waited,r.totalWait,r.waited?Math.round(r.totalWait/r.waited*10)/10:0,r.maxQueue,r.linkedShare??''])]);
});
$('record-clear').addEventListener('click',()=>{
 const button=$('record-clear');
 if(!memory.length)return;
 if(button.dataset.armed){delete button.dataset.armed;button.textContent='모두 지우기';save([]);renderRecords();}
 else{button.dataset.armed='1';button.textContent='한 번 더 누르면 지웁니다';}
});
renderRecords();
