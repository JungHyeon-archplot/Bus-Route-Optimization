import {overlapSummary} from '/src/network.js';
import {conflictGraph,colorGraph,splitRoutes,NON_DAYTIME} from '/src/coloring.js';
import {updateRouteMap} from '/public/route-map.js';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const berthColors=['#2f6fde','#e0523c','#1e9e6a','#8a5cd1','#c98a00','#0f8fa8','#b8467e','#5e6b78'];
const letter=i=>String.fromCharCode(65+i);
const svg=(tag,attrs,text='')=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);el.textContent=text;return el;};
let dataset;

function drawGraph({nodes,edges},assignment){
 const box=$('conflict');box.replaceChildren();
 const cx=230,cy=205,r=nodes.length>1?160:0,pos=new Map();
 nodes.forEach((node,i)=>{const a=-Math.PI/2+i*2*Math.PI/nodes.length;pos.set(node.id,{x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});});
 for(const {a,b,shared} of edges){const p=pos.get(a),q=pos.get(b);box.append(svg('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,class:'edge','stroke-width':Math.min(1+shared/2,5)}));}
 for(const node of nodes){
  const p=pos.get(node.id),c=assignment[node.id],g=svg('g',{class:'node'});
  g.append(svg('circle',{cx:p.x,cy:p.y,r:24,fill:berthColors[c]}));
  g.append(svg('text',{x:p.x,y:p.y+5,'text-anchor':'middle'},node.name));
  g.append(svg('title',{},`${node.name}번 · 자리 ${letter(c)}`));
  box.append(g);
 }
}

function drawAssignments(nodes,assignment){
 const list=$('assign-list');list.replaceChildren();
 for(const route of [...nodes].sort((a,b)=>assignment[a.id]-assignment[b.id]||a.name.localeCompare(b.name,'ko',{numeric:true}))){
  const li=document.createElement('li'),badge=document.createElement('span');
  badge.className='berth';badge.style.background=berthColors[assignment[route.id]];badge.textContent=letter(assignment[route.id]);
  li.append(badge,`${route.name}번${route.end?' · '+route.end+' 방면':''}`);list.append(li);
 }
}

function render(){
 const arsId=$('berth-stop').value,minShared=Number($('berth-shared').value),dwell=Number($('berth-dwell').value),seed=Math.max(1,Math.floor(Number($('sim-seed').value))||1);
 $('berth-shared-out').textContent=minShared+'곳 이상';$('berth-dwell-out').textContent=dwell+'초';
 const graph=conflictGraph(dataset,arsId,{minShared});
 const {colors,assignment:needed}=colorGraph(graph.nodes,graph.edges);
 // 실제 정차면은 몇 곳뿐이다. 필요한 자리(색)가 더 많으면 색 번호를 정차면에 돌아가며 나눈다.
 const berths=Number($('berth-count').value),split=$('split').value;
 // 분리 정류장이면 노선 배정은 두 정류장(0 = 앞, 1 = 뒤), 아니면 색 번호를 정차면에 돌아가며 나눈 것.
 const byId=new Map(dataset.routes.map(r=>[r.id,r])),volume=Object.fromEntries(graph.nodes.map(n=>[n.id,60/(byId.get(n.id)?.termMinutes??10)]));
 const zones=split?splitRoutes(graph.nodes,volume,2):null;
 const assignment=zones?zones.zoneOf:Object.fromEntries(Object.entries(needed).map(([id,c])=>[id,c%berths]));
 $('berth-count-out').textContent=berths+'곳';
 for(const el of document.querySelectorAll('.n-berths'))el.textContent=colors;
 $('stop-note').textContent=`이 정류장에 서는 주간 노선 ${graph.nodes.length}개`;
 drawGraph(graph,needed);drawAssignments(graph.nodes,assignment);
 $('coloring-note').textContent=colors>4
  ?`노선마다 겹치지 않는 자리를 주려면 최소 ${colors}곳이 필요합니다. 같은 중앙차로를 달리는 노선이 서로 모두 겹치기 때문입니다. 실제 정차면 ${berths}곳에는 색을 돌아가며 나눠 배정했습니다.`
  :`이 정류장은 자리 ${colors}곳이면 나눌 수 있습니다.${colors>berths?` 실제 정차면 ${berths}곳에는 색을 돌아가며 나눠 배정했습니다.`:''}`;
 if(zones)$('coloring-note').textContent+=` 분리 정류장 배정(목록의 A = 앞, B = 뒤): 시간당 버스 앞 ${zones.load[0].toFixed(0)}대 · 뒤 ${zones.load[1].toFixed(0)}대.`;
 updateRouteMap({stop:graph.stop,focus:arsId,base:dataset.base,routeIds:graph.nodes.map(node=>node.id),edges:graph.edges,assignment,colors:berths,dwell,seed,minShared,palette:berthColors,
  overtake:document.querySelector('input[name=lane]:checked').value==='free',meterGap:Number($('meter-gap').value),
  tsp:$('its-tsp').checked,holdRatio:Number($('its-hold').value),zones:zones?2:1,passing:split==='pass'});
 $('meter-out').textContent=Number($('meter-gap').value)?$('meter-gap').value+'초 간격':'끔';
}

// 지역마다 자료 폴더가 다르다: 서울은 /, 일산은 /ilsan/.
async function loadArea(){
 const area=$('area').value,base=area?`/${area}/`:'/';
 try{
  const response=await fetch(base+'stations.json');if(!response.ok)throw new Error();
  dataset=await response.json();dataset.base=base;
  if(!dataset.routes?.length)throw new Error();
  const select=$('berth-stop');select.replaceChildren();
  const busy=overlapSummary(dataset).busiestStops.filter(({routes})=>routes.filter(route=>!NON_DAYTIME.has(route.typeCode)).length>=3).slice(0,12);
  for(const {stop,routes} of busy)select.append(new Option(`${stop.name} (${stop.arsId}) · 노선 ${routes.length}개`,stop.arsId));
  render();
 }catch{
  $('stop-note').textContent=area?'일산 자료가 없습니다. npm run collect:ilsan 으로 먼저 수집하세요.':'경유 노선 자료가 없습니다. npm run collect:area 로 먼저 수집하세요.';
 }
}
for(const id of ['berth-stop','berth-shared','berth-dwell','sim-seed','berth-count','meter-gap'])$(id).addEventListener('input',render);
for(const input of document.querySelectorAll('input[name=lane]'))input.addEventListener('change',render);
for(const id of ['its-tsp','its-hold','split'])$(id).addEventListener('change',render);
$('area').addEventListener('change',loadArea);
await loadArea();
