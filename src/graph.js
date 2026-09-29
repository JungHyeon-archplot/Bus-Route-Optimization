function graph(edges) {
  const adj=new Map();
  for(const e of edges) {
    if(!Number.isFinite(e.weight)||e.weight<=0) throw new Error('가중치는 양수여야 합니다.');
    if(e.from===e.to) throw new Error('이 교육용 모델은 자기 루프를 지원하지 않습니다.');
    for(const [u,v] of [[e.from,e.to],[e.to,e.from]]) {
      if(!adj.has(u)) adj.set(u,[]);
      adj.get(u).push({to:v,weight:e.weight,id:e.id});
    }
  }
  if(!edges.length || new Set(edges.map(e=>e.id)).size!==edges.length) throw new Error('간선 ID 또는 입력 오류');
  return adj;
}
export function shortestPath(edges,start,target) {
  const adj=graph(edges);
  if(!adj.has(start)||!adj.has(target)) throw new Error('존재하지 않는 정점');
  const dist=new Map([...adj.keys()].map(k=>[k,Infinity])), prev=new Map(), pending=new Set(adj.keys());
  dist.set(start,0);
  while(pending.size) {
    const u=[...pending].sort((a,b)=>dist.get(a)-dist.get(b)||String(a).localeCompare(String(b)))[0];
    if(!Number.isFinite(dist.get(u))) break;
    pending.delete(u);
    if(u===target) break;
    for(const e of adj.get(u)) if(pending.has(e.to)&&dist.get(u)+e.weight<dist.get(e.to)) {
      dist.set(e.to,dist.get(u)+e.weight);prev.set(e.to,{node:u,edge:e.id});
    }
  }
  if(!Number.isFinite(dist.get(target))) throw new Error('연결되지 않은 그래프');
  const vertices=[target], edgeIds=[];
  let current=target;
  while(current!==start){const p=prev.get(current);edgeIds.unshift(p.edge);vertices.unshift(p.node);current=p.node;}
  return {cost:dist.get(target),vertices,edgeIds};
}
export function chinesePostman(edges) {
  const adj=graph(edges), nodes=[...adj.keys()];
  nodes.forEach(n=>shortestPath(edges,nodes[0],n));
  const odd=nodes.filter(n=>adj.get(n).length%2);
  if(odd.length>12) throw new Error('정확 매칭 교육 예제는 홀수 정점 12개 이하');
  const memo=new Map();
  function match(list) {
    if(!list.length)return {cost:0,pairs:[]};
    const key=list.join('|');if(memo.has(key))return memo.get(key);
    let best={cost:Infinity,pairs:[]};
    for(let i=1;i<list.length;i++){
      const route=shortestPath(edges,list[0],list[i]);
      const tail=match(list.slice(1).filter((_,j)=>j!==i-1));
      if(route.cost+tail.cost<best.cost)best={cost:route.cost+tail.cost,pairs:[route,...tail.pairs]};
    }
    memo.set(key,best);return best;
  }
  const matched=match(odd);
  const augmented=edges.map(e=>({...e,originalId:e.id}));
  for(const path of matched.pairs)for(const id of path.edgeIds){
    const original=edges.find(e=>e.id===id);
    augmented.push({...original,id:'copy-'+augmented.length,originalId:id});
  }
  const aa=new Map(nodes.map(n=>[n,[]]));
  augmented.forEach((e,i)=>{aa.get(e.from).push({i,to:e.to});aa.get(e.to).push({i,to:e.from});});
  const used=new Set(), stack=[nodes[0]], incoming=[], tour=[], traversal=[];
  while(stack.length){
    const u=stack.at(-1);const options=aa.get(u);
    while(options.length&&used.has(options.at(-1).i))options.pop();
    if(options.length){const e=options.pop();used.add(e.i);stack.push(e.to);incoming.push(e.i);}
    else{tour.push(stack.pop());if(incoming.length)traversal.push(incoming.pop());}
  }
  tour.reverse();traversal.reverse();
  return {baseCost:edges.reduce((n,e)=>n+e.weight,0),extraCost:matched.cost,
    totalCost:edges.reduce((n,e)=>n+e.weight,0)+matched.cost,odd,tour,
    traversedEdges:traversal.map(i=>augmented[i].originalId)};
}
// Deterministic greedy coloring: valid upper bound, NOT minimum coloring or a planarity proof.
export function colorGraph(nodes, conflicts) {
  if(new Set(nodes).size!==nodes.length)throw new Error('정점 중복');
  const neighbors=new Map(nodes.map(n=>[n,new Set()]));
  conflicts.forEach(([u,v])=>{if(u===v||!neighbors.has(u)||!neighbors.has(v))throw new Error('충돌 간선 오류');neighbors.get(u).add(v);neighbors.get(v).add(u);});
  const order=[...nodes].sort((a,b)=>neighbors.get(b).size-neighbors.get(a).size||String(a).localeCompare(String(b)));
  const colors={};
  for(const n of order){const taken=new Set([...neighbors.get(n)].map(x=>colors[x]));let c=0;while(taken.has(c))c++;colors[n]=c;}
  return {colors,count:Math.max(...Object.values(colors))+1,optimalityGuaranteed:false};
}

