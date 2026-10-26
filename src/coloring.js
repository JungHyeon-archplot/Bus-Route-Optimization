// Route conflict graph at one stop, and its exact coloring.
// Two routes conflict when they also share at least `minShared` stops in the dataset: they run the same corridor
// and tend to arrive together. Each color is one berth (정차면) group.
export const NON_DAYTIME=new Set(['10','15']); // 관광·심야 코드: 주간 병목 분석에서 제외

export function conflictGraph(dataset,arsId,{minShared=3}={}){
 const stop=dataset.stops.find(item=>item.arsId===arsId);
 if(!stop)throw new Error('Unknown stop '+arsId);
 const byId=new Map(dataset.routes.map(route=>[route.id,route]));
 const nodes=[...new Set(stop.routes)].map(id=>byId.get(id)).filter(route=>route&&!NON_DAYTIME.has(route.typeCode));
 const stopsOf=new Map(nodes.map(route=>[route.id,new Set(dataset.stops.filter(item=>item.routes.includes(route.id)).map(item=>item.arsId))]));
 const edges=[];
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=stopsOf.get(nodes[i].id),shared=[...stopsOf.get(nodes[j].id)].filter(id=>a.has(id)).length;
  if(shared>=minShared)edges.push({a:nodes[i].id,b:nodes[j].id,shared});
 }
 return {stop,nodes,edges};
}

// 분리 정류장 배정: 시간당 버스 수(volume)를 k곳에 고르게 나눈다(버스가 많은 노선부터 부하가 가장 적은 곳에 — LPT).
// 함께 달리는 노선을 떼어 놓는 그래프 조건도 시험했지만 지연이 줄지 않았고(신용산 196분 vs 균형만 186분), 균형이 깨지면 크게 나빠졌다
// (일산동구청 무작위 배정 최대 324분 vs 균형 224분). 그래서 균형만 쓴다.
export function splitRoutes(nodes,volume,k=2){
 const load=Array(k).fill(0),zoneOf={};
 for(const node of [...nodes].sort((x,y)=>(volume[y.id]??0)-(volume[x.id]??0)||x.id.localeCompare(y.id))){
  const z=load.indexOf(Math.min(...load));zoneOf[node.id]=z;load[z]+=volume[node.id]??0;
 }
 return {zoneOf,load};
}

// Minimum coloring. 큰 클릭(서로 다 겹치는 노선 묶음)의 크기가 하한, DSatur 탐욕 색칠이 상한이다.
// 둘이 같으면 그대로 최소이고, 다르면 그 사이를 백트래킹으로 확인한다(중앙차로처럼 노선이 20개를 넘어도 빠름).
export function colorGraph(nodes,edges){
 const ids=nodes.map(node=>node.id),adj=new Map(ids.map(id=>[id,new Set()]));
 for(const {a,b} of edges){adj.get(a).add(b);adj.get(b).add(a);}
 const order=[...ids].sort((x,y)=>adj.get(y).size-adj.get(x).size||x.localeCompare(y));
 // 하한: 차수 순으로 서로 모두 이어진 노선을 모은 클릭.
 const clique=[];for(const id of order)if(clique.every(other=>adj.get(id).has(other)))clique.push(id);
 // 상한: DSatur.
 const greedy=new Map();
 while(greedy.size<ids.length){
  const sat=id=>new Set([...adj.get(id)].map(o=>greedy.get(o)).filter(c=>c!==undefined)).size;
  const id=order.filter(i=>!greedy.has(i)).sort((x,y)=>sat(y)-sat(x)||adj.get(y).size-adj.get(x).size||x.localeCompare(y))[0];
  let c=0;while([...adj.get(id)].some(o=>greedy.get(o)===c))c++;greedy.set(id,c);
 }
 let best=ids.length?Math.max(...greedy.values())+1:0,assign=greedy;
 // 클릭을 먼저 0..ω-1로 고정하면 같은 색 배치의 대칭을 줄일 수 있다.
 const rest=order.filter(id=>!clique.includes(id));
 for(let k=clique.length;k<best;k++){
  const color=new Map(clique.map((id,i)=>[id,i]));let steps=0;
  const fill=index=>{
   if(++steps>2e6)throw new Error('budget');
   if(index===rest.length)return true;
   const id=rest[index];
   for(let c=0;c<k;c++){
    if([...adj.get(id)].some(other=>color.get(other)===c))continue;
    color.set(id,c);if(fill(index+1))return true;color.delete(id);
   }
   return false;
  };
  let ok;try{ok=fill(0);}catch{break;} // ponytail: 탐색 한도를 넘으면 DSatur 결과(상한)를 쓴다
  if(ok){best=k;assign=color;break;}
 }
 return {colors:best,assignment:Object.fromEntries(ids.map(id=>[id,assign.get(id)]))};
}
