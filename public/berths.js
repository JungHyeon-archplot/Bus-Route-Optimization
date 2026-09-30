import {overlapSummary} from '/src/network.js';
import {conflictGraph,colorGraph,NON_DAYTIME} from '/src/coloring.js';
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
 const arsId=$('berth-stop').value,minShared=Number($('berth-shared').value),dwell=Number($('berth-dwell').value);
 $('berth-shared-out').textContent=minShared+'곳 이상';$('berth-dwell-out').textContent=dwell+'초';
 const graph=conflictGraph(dataset,arsId,{minShared});
 const {colors,assignment}=colorGraph(graph.nodes,graph.edges);
 for(const el of document.querySelectorAll('.n-berths'))el.textContent=colors;
 $('stop-note').textContent=`이 정류장에 서는 주간 노선 ${graph.nodes.length}개`;
 drawGraph(graph,assignment);drawAssignments(graph.nodes,assignment);
 $('coloring-note').textContent=colors>4
  ?`이 정류장은 자리가 최소 ${colors}곳 필요합니다. 서로 모두 이어진 노선 묶음이 있어 4곳(네 가지 색)으로는 나눌 수 없습니다.`
  :`이 정류장은 자리 ${colors}곳이면 나눌 수 있습니다.`;
 updateRouteMap({stop:graph.stop,focus:arsId,routeIds:graph.nodes.map(node=>node.id),edges:graph.edges,assignment,colors,dwell,palette:berthColors});
}

try{
 const response=await fetch('/stations.json');if(!response.ok)throw new Error();
 dataset=await response.json();
 if(!dataset.routes?.length)throw new Error();
 const select=$('berth-stop');
 const busy=overlapSummary(dataset).busiestStops.filter(({routes})=>routes.filter(route=>!NON_DAYTIME.has(route.typeCode)).length>=3).slice(0,12);
 for(const {stop,routes} of busy)select.append(new Option(`${stop.name} (${stop.arsId}) · 노선 ${routes.length}개`,stop.arsId));
 for(const id of ['berth-stop','berth-shared','berth-dwell'])$(id).addEventListener('input',render);
 render();
}catch{
 $('stop-note').textContent='경유 노선 자료가 없습니다. npm run collect:area 로 먼저 수집하세요.';
}
