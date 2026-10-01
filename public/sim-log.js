import {summarizeLog} from '/src/routesim.js';
import {showTab} from '/public/ui.js';
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

// ---- Experiment records: one row per recorded run, so conditions can be compared later. ----
// Shared with the whole team through /records when the deployment has a store; otherwise kept in this browser only.
const KEY='bus-sim-records-v1',CODE_KEY='bus-sim-team-code',NAME_KEY='bus-sim-name';
const TIMING={random:'제각각',spread:'간격 두기'};
const keyOf=record=>[record.arsId,record.rule,record.timing,record.dwell,record.seed,record.minShared].join('-');
const stored=(key,fallback='')=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const store=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* storage blocked: keep for this page only */}};
let memory=[],shared=false;

const status=(message,bad=false)=>{const el=$('record-status');el.textContent=message;el.classList.toggle('bad',bad);};
const saveLocal=records=>{memory=records;store(KEY,JSON.stringify(records));};

async function api(method,path,body){
 const response=await fetch(path,{method,headers:{'Content-Type':'application/json','x-team-code':$('team-code').value.trim()},body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'저장소가 응답하지 않습니다.');
 return data;
}

function renderRecords(){
 const list=$('record-list'),max=Math.max(1,...memory.map(record=>record.totalWait));
 list.replaceChildren();
 $('record-count').textContent=memory.length?String(memory.length):'';
 if(!memory.length){const li=document.createElement('li');li.className='empty';li.textContent='아직 기록이 없습니다. 조건을 고르고 "지금 조건의 결과 기록하기"를 누르세요.';list.append(li);return;}
 memory.forEach((record,index)=>{
  const li=document.createElement('li'),head=document.createElement('div'),name=document.createElement('span'),value=document.createElement('b'),track=document.createElement('div'),fill=document.createElement('i'),meta=document.createElement('small'),remove=document.createElement('button');
  name.textContent=`${index+1}. ${RULES[record.rule]}${record.rule==='single'?'':` ${record.berths}곳`} · ${TIMING[record.timing]} · ${record.dwell}초`;
  value.textContent=secs(record.totalWait);head.append(name,value);
  track.className='track';fill.style.width=(record.totalWait/max*100)+'%';track.append(fill);
  meta.textContent=`${record.stopName} · ${record.served}대 중 ${record.waited}대 기다림 · 긴 줄 ${record.maxQueue}대 · seed ${record.seed} · 기준 ${record.minShared}곳${record.by?' · '+record.by:''}`;
  remove.type='button';remove.className='remove';remove.textContent='지우기';remove.setAttribute('aria-label',`${index+1}번 기록 지우기`);
  remove.addEventListener('click',async()=>{
   try{
    if(shared)await api('DELETE','/records?id='+record.id);
    const rest=memory.filter(item=>item!==record);
    if(shared)memory=rest;else saveLocal(rest);
    renderRecords();status(shared?'팀 기록에서 지웠습니다.':'');
   }catch(error){status(error.message,true);}
  });
  li.append(head,track,meta,remove);list.append(li);
 });
}

$('record-add').addEventListener('click',async()=>{
 if(!lastRuns)return;
 // Team recording needs the code: open the records tab and point at the field instead of failing silently.
 if(shared&&!$('team-code-row').hidden&&!$('team-code').value.trim()){showTab('ptab-rec');$('team-code').focus();status('팀 기록에 남기려면 "팀 기록" 탭에서 팀 코드를 먼저 입력하세요.',true);return;}
 const ctx=lastCtx,{s}=lastRuns.find(run=>run.key===ctx.rule),pairs=summarizeLog(s.log).pairs;
 const total=pairs.reduce((sum,pair)=>sum+pair.totalWait,0),linked=pairs.filter(pair=>ctx.linked(pair.blocker,pair.blocked)).reduce((sum,pair)=>sum+pair.totalWait,0);
 let record={savedAt:new Date().toISOString(),arsId:ctx.arsId,stopName:ctx.stopName,rule:ctx.rule,timing:ctx.timing,dwell:ctx.dwell,seed:ctx.seed,minShared:ctx.minShared,
  berths:ctx.rule==='single'?1:ctx.colors,hours:2,served:s.served,waited:s.waited,totalWait:Math.round(s.totalWait),maxQueue:s.maxQueue,linkedShare:total?Math.round(linked/total*100):null,by:$('record-by').value.trim().slice(0,20)};
 try{
  if(shared){record=(await api('POST','/records',record)).record;store(NAME_KEY,record.by);}
  // Team records pile up and are never overwritten; the browser-only fallback still replaces the same conditions.
  if(shared)memory=[...memory,record];
  else saveLocal([...memory.filter(item=>keyOf(item)!==keyOf(record)),record]);
  renderRecords();status(shared?`팀 기록에 저장했습니다(${memory.length}건). "팀 기록" 탭에서 비교할 수 있습니다.`:'이 브라우저에 저장했습니다. "팀 기록" 탭에서 비교할 수 있습니다.');
 }catch(error){status(error.message,true);}
});
$('record-csv').addEventListener('click',()=>{
 if(!memory.length)return;
 saveCsv('실험기록.csv',[['기록 시각','기록한 사람','정류장','ARS','서는 방식','설 자리 수','버스 오는 시점','정차(초)','seed','함께 달림 기준(공유 정류장)','모의 시간(시간)','정차한 버스','기다린 버스','기다린 시간 합(초)','기다린 버스 평균 대기(초)','가장 긴 줄','이어진 쌍에서 생긴 대기(%)'],
  ...memory.map(r=>[new Date(r.savedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),r.by??'',r.stopName,r.arsId,RULES[r.rule],r.berths,TIMING[r.timing],r.dwell,r.seed,r.minShared,r.hours,r.served,r.waited,r.totalWait,r.waited?Math.round(r.totalWait/r.waited*10)/10:0,r.maxQueue,r.linkedShare??''])]);
});
$('record-refresh').addEventListener('click',loadRecords);

async function loadRecords(){
 try{
  const response=await fetch('/records');
  if(!response.ok)throw new Error('none');
  const data=await response.json();
  shared=true;memory=data.records;
  $('record-mode').textContent='팀 전체가 같은 목록을 봅니다. 같은 조건도 덮어쓰지 않고 쌓이며, 다른 사람이 넣은 기록은 "새로 고침"으로 바로 불러옵니다.';
  $('team-fields').hidden=false;$('team-code-row').hidden=!data.needsCode;
 }catch{
  shared=false;
  try{memory=JSON.parse(stored(KEY,'[]'))??[];}catch{memory=[];}
  $('record-mode').textContent='공유 저장소가 없는 환경이라 이 브라우저에만 저장됩니다.';
  $('team-fields').hidden=true;
 }
 renderRecords();
}
$('team-code').value=stored(CODE_KEY);$('record-by').value=stored(NAME_KEY);
$('team-code').addEventListener('change',()=>store(CODE_KEY,$('team-code').value.trim()));
loadRecords();
