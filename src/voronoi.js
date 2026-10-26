// Euclidean half-plane intersection for a bounded educational diagram.
export function voronoiCells(points,bounds) {
 const {minX,minY,maxX,maxY}=bounds;
 if(![minX,minY,maxX,maxY].every(Number.isFinite)||minX>=maxX||minY>=maxY)throw new Error('Invalid bounds');
 const ids=new Set(),positions=new Set();
 for(const p of points){
  const key=`${p.x},${p.y}`;
  if(!p.id||ids.has(p.id)||positions.has(key)||![p.x,p.y].every(Number.isFinite))throw new Error('Sites require distinct IDs and finite, distinct positions');
  ids.add(p.id);positions.add(key);
 }
 return points.map(p=>{
  let polygon=[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}];
  for(const q of points){
   if(p===q)continue;
   const nx=q.x-p.x,ny=q.y-p.y,mx=(p.x+q.x)/2,my=(p.y+q.y)/2;
   const distance=v=>nx*(v.x-mx)+ny*(v.y-my);
   const clipped=[];
   for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b);
    if(da<=0)clipped.push(a);
    if((da<=0)!==(db<=0)){const t=da/(da-db);clipped.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
   }
   polygon=clipped;
  }
  return {id:p.id,polygon};
 });
}
