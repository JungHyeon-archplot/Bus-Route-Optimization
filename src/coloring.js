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

// Exact minimum coloring by backtracking; fine for the ≤16 routes a single stop carries.
export function colorGraph(nodes,edges){
 if(nodes.length>16)throw new Error('Too many routes for exact coloring');
 const ids=nodes.map(node=>node.id),adj=new Map(ids.map(id=>[id,new Set()]));
 for(const {a,b} of edges){adj.get(a).add(b);adj.get(b).add(a);}
 const order=[...ids].sort((x,y)=>adj.get(y).size-adj.get(x).size||x.localeCompare(y));
 const color=new Map();
 const fill=(index,k)=>{
  if(index===order.length)return true;
  const id=order[index];
  for(let c=0;c<k;c++){
   if([...adj.get(id)].some(other=>color.get(other)===c))continue;
   color.set(id,c);if(fill(index+1,k))return true;color.delete(id);
  }
  return false;
 };
 let k=ids.length?1:0;
 while(k<ids.length&&!fill(0,k)){color.clear();k++;}
 if(k===ids.length&&color.size<ids.length)fill(0,k);
 return {colors:k,assignment:Object.fromEntries(ids.map(id=>[id,color.get(id)]))};
}
