import {loadSdk} from '/public/map.js';
import {prepareRoute,positionAt,createSim,step} from '/src/routesim.js';
import {renderLog,resetLiveLog,updateLiveLog} from '/public/sim-log.js';
const $=id=>document.getElementById(id);
const GREY='#1f3a5f';
let routeLines=new Map(),liveInterval=15,maps,map,routesData,preps=new Map(),layers=[],busOverlays=[],liveOverlays=[],sim,params,rule='pooled',timing='random',tableTimer,playing=false,rate=30,last=0,liveTimer;

function clear(list){for(const item of list)item.setMap(null);list.length=0;}
function dot(className,color,title){const el=document.createElement('span');el.className=className;el.style.background=color;el.title=title;return el;}

// 화면과 표가 같은 조건으로 돌도록 한곳에서 만든다. 진입 통제 지점은 정류장 50m 앞.
// 분리 정류장을 고르면 세 번째 줄(colored)이 분리 정류장, 두 번째 줄(pooled)은 같은 정차면을 한 정류장에 일렬로 둔 경우다.
// 정차 습관이 '입구 쪽에 바로 서기'면 빈 곳에 서는 줄(pooled)과 분리 정류장 줄을 그 습관(rear)으로 돌린다.
const free=()=>params.habit==='rear'?'rear':'pooled';
const layout=key=>params.zones>1
 ?key==='colored'?{rule:free(),zones:2,berths:params.colors,zoneOf:params.assignment,passing:params.passing}
  :{rule:key==='pooled'?free():key,berths:params.colors*2}
 :{rule:key==='pooled'?free():key,berths:params.colors};
const options=key=>({focus:params.focus,assignment:params.assignment,...layout(key),dwell:params.dwell,...(params.stopDwell&&{stopDwell:params.stopDwell}),seed:params.seed,timing,
 overtake:params.overtake,meterGap:params.meterGap,meterAt:50,
 // 연쇄 지연과 흔들림은 실측 몰림 정도에 맞춘 값(scripts/lane-experiment.mjs와 같음).
 cascade:true,noise:params.calib.noise,startJitter:params.calib.startJitter,signal:true,tsp:params.tsp,holdRatio:params.holdRatio});
const clock=s=>s<1?'0초':`${Math.floor(s/60)}분 ${Math.round(s%60)}초`;

function rebuildSimMapOnly(){
 const {focus,routeIds,assignment,palette}=params;
 const list=routeIds.map(id=>preps.get(id)).filter(Boolean);
 sim=createSim(list,options(rule));
 clear(busOverlays);
 for(const [id,line] of routeLines)line.setOptions(rule==='colored'?{strokeColor:palette[assignment[id]],strokeOpacity:.55,strokeWeight:4}:{strokeColor:'#5b6770',strokeOpacity:.35,strokeWeight:4});
 for(const bus of sim.buses){
  const color=rule==='colored'?palette[assignment[bus.route]]:GREY;
  const el=dot('bus-dot',color,bus.prep.route.name);
  bus.el=el;
  const overlay=new maps.CustomOverlay({position:new maps.LatLng(...positionAt(bus.prep,bus.u)),content:el,xAnchor:.5,yAnchor:.5,zIndex:3});
  overlay.setMap(map);bus.overlay=overlay;busOverlays.push(overlay);
 }
 const skipped=list.filter(prep=>prep.stopAt[focus]===undefined).map(prep=>prep.route.name);
 $('sim-skipped').textContent=skipped.length?`${skipped.join(', ')}번은 이 정류장 위치를 경로에 맞추지 못해 움직이기만 하고 줄 계산에서는 빠집니다.`:'';
 resetLiveLog();
 draw();
}
function rebuildSim(){
 rebuildSimMapOnly();
 // 연달아 바꿀 때 마지막 조건만 계산한다.
 clearTimeout(tableTimer);tableTimer=setTimeout(()=>renderTable(params.routeIds.map(id=>preps.get(id)).filter(Boolean)),200);
}

// Same simulation, run headless for 2 hours under each way of stopping, so the table matches what the map shows.
// 계산은 sim-worker.js에서 돈다. 조건이 또 바뀌면 돌던 계산을 버리고 새로 시작한다.
let worker,lastRows,lastBase;
const BASE_LABEL='지금 그대로(추월차로 없음·정차면 3곳·대책 없음)';
function renderTable(list){
 const {colors}=params;
 const rows=(params.zones>1
  ?[['single','정차면 1곳'],['pooled',`한 정류장 ${colors*2}면${params.habit==='rear'?'·입구에 서기':''}`],['colored',`분리 2곳×${colors}면${params.passing?'':'·공간 없음'}`]]
  :[['single','정차면 1곳'],['pooled',`${colors}곳 · ${params.habit==='rear'?'입구 쪽에 서기':'앞자리부터 서기'}`],['colored',`${colors}곳 · 노선별 지정`]]);
 // 비교 기준: 같은 정류장을 지금 구조 그대로, 대책 없이 돌린 값.
 const base={...options('pooled'),rule:'pooled',berths:3,zones:1,overtake:false,tsp:false,holdRatio:0,meterGap:0,dwell:40,timing:'random'};
 const jobs=[...rows.map(([key])=>({key,options:options(key)})),{key:'base',options:base}];
 worker?.terminate();
 worker=new Worker('/public/sim-worker.js',{type:'module'});
 $('calc').hidden=false;$('result-bars').closest('.summary').classList.add('busy');
 const ids=new Set(list.map(prep=>prep.route.id));
 worker.onmessage=({data:{results}})=>{
  worker.terminate();worker=undefined;
  $('calc').hidden=true;$('result-bars').closest('.summary').classList.remove('busy');
  const by=Object.fromEntries(results.map(r=>[r.key,r.s]));
  lastBase=by.base;lastRows=rows.map(([key,label])=>({key,label,s:by[key]}));
  drawRows();renderLog(lastRows,logContext());
 };
 worker.onerror=()=>{$('calc').hidden=true;$('result-detail').textContent='계산 중 오류가 났습니다. 새로 고침해 보세요.';};
 worker.postMessage({routes:routesData.routes.filter(route=>ids.has(route.id)),jobs});
}

const pct=(from,to)=>{if(!from)return '';const p=Math.round((to-from)/from*100);return p?`${p<0?'−':'+'}${Math.abs(p)}%`:'변화 없음';};
function drawRows(){
 if(!lastRows)return;
 const list0=$('result-bars'),max=Math.max(1,...lastRows.map(row=>row.s.delay));
 list0.replaceChildren();
 // Each result row is also the switch for that way of stopping: compare and choose in one place.
 for(const {key,label,s} of lastRows){
  const li=document.createElement('li');if(key===rule)li.className='current';
  const pick=document.createElement('label'),input=document.createElement('input');
  input.type='radio';input.name='rule';input.value=key;input.checked=key===rule;
  const head=document.createElement('div'),name=document.createElement('span'),value=document.createElement('b'),pax=document.createElement('i');
  name.textContent=label;name.title=label;value.textContent=clock(s.delay);pax.textContent=clock(s.passenger.actual);head.append(name,value,pax);
  const track=document.createElement('div'),fill=document.createElement('i');track.className='track';fill.style.width=(s.delay/max*100)+'%';track.append(fill);
  pick.append(input,head,track);li.append(pick);list0.append(li);
 }
 const s=lastRows.find(row=>row.key===rule)?.s;if(!s)return;
 // 늦어진 시간 = 정류장 앞 줄서기 + 승하차 뒤 앞차 때문에 갇힌 시간 + 신호 대기 + 통제로 기다린 시간.
 $('result-detail').textContent=`줄서기 ${clock(s.totalWait)}${params.overtake?'':` · 갇힘 ${clock(s.exitWait)}`} · 신호 ${clock(s.signalWait)}${s.hold?` · 통제 대기 ${clock(s.hold)}`:''} · 가장 긴 줄 ${s.maxQueue}대 · 계획 배차대로면 승객 대기 ${clock(s.passenger.planned)}`;
 const base=$('result-base');base.replaceChildren();
 if(lastBase){
  const b=document.createElement('b');b.textContent=`버스 지연 ${pct(lastBase.delay,s.delay)} · 승객 대기 ${pct(lastBase.passenger.actual,s.passenger.actual)}`;
  base.append('지금 그대로와 비교 ',b);base.title=`${BASE_LABEL}: 버스 지연 ${clock(lastBase.delay)} · 승객 대기 ${clock(lastBase.passenger.actual)}`;
 }
}

function logContext(){
 const {focus,stop,edges=[],dwell,colors,seed,minShared}=params,links=new Set(edges.flatMap(e=>[e.a+'|'+e.b,e.b+'|'+e.a]));
 return {rule,timing,dwell,colors,seed,minShared,arsId:focus,stopName:stop.name,name:id=>preps.get(id)?.route.name??id,linked:(a,b)=>links.has(a+'|'+b)};
}

function draw(){
 for(const bus of sim.buses){
  bus.overlay.setPosition(new maps.LatLng(...positionAt(bus.prep,bus.u)));
  bus.el.classList.toggle('queued',bus.state==='queue'||bus.state==='hold'||bus.state==='blocked');
 }
 const {served,waited,totalWait}=sim.stats;
 $('sim-clock').textContent=`${Math.floor(sim.time/60)}분`;
 $('stat-served').textContent=served;$('stat-waited').textContent=waited;$('stat-queue').textContent=sim.queue.length;
 $('stat-queue').parentElement.classList.toggle('alert',sim.queue.length>0);
 updateLiveLog(sim,logContext());
}

function frame(now){
 if(!playing)return;
 const elapsed=Math.min(0.25,(now-(last||now))/1000)*rate;last=now;
 for(let t=0;t<elapsed;t+=1)step(sim,Math.min(1,elapsed-t));
 draw();requestAnimationFrame(frame);
}

async function refreshLive(){
 clear(liveOverlays);
 const responses=await Promise.all(params.routeIds.map(id=>fetch('/live/buspos?routeId='+id).then(async r=>({ok:r.ok,body:await r.json()})).catch(()=>null)));
 clear(liveOverlays);
 let count=0,stamp='',quota;
 for(const response of responses.filter(Boolean)){
  const result=response.body;
  if(result.dailyLimit)quota=result;
  if(!response.ok)continue;
  const name=preps.get(result.routeId)?.route.name??'';
  for(const bus of result.buses){
   const overlay=new maps.CustomOverlay({position:new maps.LatLng(bus.lat,bus.lng),content:dot('live-dot',params.palette[params.assignment[result.routeId]]??GREY,`${name}번 ${bus.plainNo}`),xAnchor:.5,yAnchor:.5,zIndex:4});
   overlay.setMap(map);liveOverlays.push(overlay);count++;stamp=result.fetchedAt;
  }
 }
 const left=quota?Math.max(0,quota.dailyLimit-quota.callsToday):0;
 const minutes=Math.floor(left/params.routeIds.length*liveInterval/60);
 const budget=quota?` · 오늘 호출 ${quota.callsToday}/${quota.dailyLimit}회, 이 간격이면 약 ${minutes}분 더 볼 수 있음`:'';
 if(quota&&left===0){stopLive();$('live-toggle').checked=false;$('live-status').textContent=`오늘 실시간 위치 호출 한도(${quota.dailyLimit}회)에 닿아 멈췄습니다. 시뮬레이션은 계속 쓸 수 있습니다.`;return;}
 $('live-status').textContent=count?`실제 버스 ${count}대 · ${new Date(stamp).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'})} 기준 · ${liveInterval}초마다 갱신${budget}`:'실시간 위치를 받지 못했습니다. 잠시 뒤 다시 켜 보세요.';
}
// 지역이 바뀌면 그 지역 주요 정류장이 다 보이게, 정류장만 바뀌면 그 정류장으로 옮긴다.
function focusMap(wide){
 map.relayout();
 if(wide&&params.areaStops?.length>1){
  const bounds=new maps.LatLngBounds();
  for(const [lat,lng] of params.areaStops)bounds.extend(new maps.LatLng(lat,lng));
  map.setBounds(bounds,60,60,60,60);
 }else{map.setLevel(4);map.setCenter(new maps.LatLng(params.stop.lat,params.stop.lng));}
}
function stopLive(){clearInterval(liveTimer);liveTimer=undefined;}
function startLive(){stopLive();if(!map)return;refreshLive();liveTimer=setInterval(refreshLive,liveInterval*1000);}

// 발표 모드가 다음 updateRouteMap에서 쓸 방식(rule)과 시작 시점·빠르기를 맡겨 둔다.
// 지역을 바꾸면 updateRouteMap이 겹쳐 불린다. 마지막 호출만 발표 모드 시작 시점을 쓴다.
let demoRun,calls=0;
export function queueDemoRun({rule:key,at,rate:r}){rule=key;demoRun={at,rate:r};}

export async function updateRouteMap(next){
 const call=++calls;
 const areaChanged=params?.base!==next.base;
 params=next;
 if(map)focusMap(areaChanged);
 try{
  // Route data first: the results and records only need the geometry, not the map.
  if(routesData?.base!==params.base){
   const response=await fetch(params.base+'routes.json');
   if(!response.ok)throw new Error('노선 경로 자료가 없습니다. npm run collect:routes 로 먼저 수집하세요.');
   routesData=await response.json();routesData.base=params.base;
   for(const route of routesData.routes)preps.set(route.id,prepareRoute(route));
   // 실시간 위치는 서울시 API라 서울 노선만 볼 수 있다.
   const seoulOnly=params.base!=='/';$('live-toggle').disabled=seoulOnly;
   if(seoulOnly&&liveTimer){stopLive();clear(liveOverlays);$('live-toggle').checked=false;}
   $('live-status').textContent=seoulOnly?'실시간 위치 겹쳐 보기는 서울 지역에서만 됩니다.':'';
  }
  $('sim-source').textContent=`노선 경로·정류장 순서: ${params.base==='/'?'서울시 노선정보조회':'경기도 버스노선 조회'}, ${new Date(routesData.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} 수집.`;
  if(!map){
   try{
    const config=await fetch('/config.json').then(r=>r.json());
    if(!config.kakaoJsKey)throw new Error('지도 키가 설정되지 않았습니다.');
    await loadSdk(config.kakaoJsKey);maps=window.kakao.maps;
    map=new maps.Map($('route-map'),{center:new maps.LatLng(37.56,126.995),level:4});
    map.addControl(new maps.ZoomControl(),maps.ControlPosition.RIGHT);
    addEventListener('resize',()=>{map.relayout();map.setCenter(new maps.LatLng(params.stop.lat,params.stop.lng));});
    $('route-map-error').textContent='';
   }catch(error){
    $('route-map-error').textContent=error.message+' 지도 없이 오른쪽 결과와 기록은 계속 쓸 수 있습니다.';
    clearTimeout(tableTimer);tableTimer=setTimeout(()=>renderTable(params.routeIds.map(id=>preps.get(id)).filter(Boolean)),30);
    return;
   }
  }
  if(call!==calls)return; // 더 새 호출이 이미 그리는 중
  clear(layers);routeLines.clear();
  const stop=params.stop;
  for(const id of params.routeIds){
   const route=preps.get(id)?.route;if(!route)continue;
   const line=new maps.Polyline({map,path:route.path.map(([lat,lng])=>new maps.LatLng(lat,lng)),strokeWeight:4,strokeColor:'#5b6770',strokeOpacity:.35});
   layers.push(line);routeLines.set(id,line);
  }
  const label=document.createElement('div');label.className='focus-stop';label.innerHTML='<span></span>';label.firstChild.textContent=stop.name;
  layers.push(new maps.CustomOverlay({map,position:new maps.LatLng(stop.lat,stop.lng),content:label,xAnchor:.5,yAnchor:1,zIndex:5}));
  focusMap(areaChanged);
  rebuildSim();
  if(demoRun&&call===calls){
   // 발표 모드: 줄이 생길 때까지 미리 돌려 두고 바로 재생한다.
   const {at,rate:r}=demoRun;demoRun=undefined;
   for(let t=0;t<at;t++)step(sim,1);
   draw();rate=r;
   if(!playing)$('sim-play').click();
  }
  if(liveTimer)refreshLive();
 }catch(error){$('route-map-error').textContent=error.message;}
}

// Delegated: the rule radios are re-created with every result update.
document.addEventListener('change',event=>{
 if(event.target.name!=='rule'&&event.target.name!=='timing')return;
 rule=document.querySelector('input[name=rule]:checked')?.value??rule;timing=document.querySelector('input[name=timing]:checked').value;
 if(event.target.name==='rule'){drawRows();if(sim)rebuildSimMapOnly();return;}
 if(sim)rebuildSim();
 else if(routesData&&params)renderTable(params.routeIds.map(id=>preps.get(id)).filter(Boolean)); // no map: numbers only
});
$('sim-play').addEventListener('click',()=>{
 if(!sim)return;
 playing=!playing;$('sim-play').classList.toggle('playing',playing);$('sim-play').setAttribute('aria-label',playing?'멈춤':'재생');
 if(playing){last=0;requestAnimationFrame(frame);}
});
$('sim-reset').addEventListener('click',()=>{if(sim)rebuildSimMapOnly();});
for(const input of document.querySelectorAll('input[name=rate]'))input.addEventListener('change',()=>{rate=Number(input.value);});
$('live-toggle').addEventListener('change',event=>{
 stopLive();clear(liveOverlays);$('live-status').textContent='';
 if(event.target.checked)startLive();
});
$('live-interval').addEventListener('input',event=>{liveInterval=Number(event.target.value);if(liveTimer)startLive();});
