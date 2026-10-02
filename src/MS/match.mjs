// Pairs the particles of two shapes for a flight so that neighbours stay
// neighbours: both point sets are cut into the same number of horizontal
// bands, top to bottom, and each band is paired left to right. A cut never
// splits a lattice row, so a band holds whole rows. Every particle then flies
// along with the ones around it and the liquid moves as one connected sheet
// instead of tearing into dust.
// Returns, for every point of `to`, the index of its partner in `from`.
export function matchPoints(from,to,bands=Math.round(Math.sqrt(Math.min(from.length,to.length)))){
 const nf=from.length,nt=to.length,out=new Int32Array(nt);
 if(!nf||!nt)return out;
 const k=Math.max(1,Math.min(bands,nf,nt));
 const byRow=pts=>Array.from(pts.keys()).sort((a,b)=>pts[a].y-pts[b].y||pts[a].x-pts[b].x);
 const fy=byRow(from),ty=byRow(to);
 // Band edges: the share b/k of the points, moved on to the end of the row.
 const cuts=(pts,order)=>{const n=order.length,c=[0];
  for(let b=1;b<k;b++){let i=Math.max(c[b-1],Math.floor(b*n/k));while(i>0&&i<n&&pts[order[i]].y===pts[order[i-1]].y)i++;c.push(i);}
  c.push(n);return c;};
 const cf=cuts(from,fy),ct=cuts(to,ty);
 // A band left empty on either side joins the next one.
 let f0=0,t0=0;
 for(let b=1;b<=k;b++){
  const f1=cf[b],t1=ct[b];
  if((f1===f0||t1===t0)&&b<k)continue;
  if(t1>t0&&f1>f0){
   const fb=fy.slice(f0,f1).sort((a,c)=>from[a].x-from[c].x),tb=ty.slice(t0,t1).sort((a,c)=>to[a].x-to[c].x);
   for(let r=0;r<tb.length;r++)out[tb[r]]=fb[Math.min(fb.length-1,Math.floor((r+.5)*fb.length/tb.length))];
  }else if(t1>t0){
   // Only the last band can end up without sources; it takes the last row.
   for(let i=t0;i<t1;i++)out[ty[i]]=fy[nf-1];
  }
  f0=f1;t0=t1;
 }
 return out;
}
