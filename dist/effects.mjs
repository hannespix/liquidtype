// Effects shared by the Liquid Type pages, all acting on a Fluid (see
// physics.mjs): letters condensing from a cloud, a burst away from a point,
// a drop detaching from the lowest edge, calm detection, settling phases
// and the path of an invisible idle hand. No DOM; random sources can be
// passed in for tests.

// Scatters every particle around its target, up to `spread` px away, inside
// the fluid's bounds and at rest; the springs then condense the letters.
export function scatterAround(fluid,spread,random=Math.random){
 const s=fluid.spacing,clampX=v=>Math.max(s,Math.min(fluid.width-s,v)),clampY=v=>Math.max(s,Math.min(fluid.height-s,v));
 for(let i=0;i<fluid.n;i++){
  const a=random()*Math.PI*2,d=spread*Math.sqrt(random());
  fluid.x[i]=clampX(fluid.tx[i]+Math.cos(a)*d);fluid.y[i]=clampY(fluid.ty[i]+Math.sin(a)*d);fluid.vx[i]=fluid.vy[i]=0;
 }
}
// Sends every particle away from (x, y), the faster the closer it is, out
// to the larger side of the fluid. Releasing the springs for a moment
// (`free`) is up to the page.
export function burstFrom(fluid,x,y,speed,random=Math.random){
 const R=Math.max(fluid.width,fluid.height);
 for(let i=0;i<fluid.n;i++){
  const dx=fluid.x[i]-x,dy=fluid.y[i]-y,d=Math.hypot(dx,dy)||1,f=1-d/R;
  if(f<=0)continue;
  const v=speed*Math.sqrt(f)*(.8+.4*random());
  fluid.vx[i]=Math.max(-1500,Math.min(1500,fluid.vx[i]+dx/d*v));fluid.vy[i]=Math.max(-1500,Math.min(1500,fluid.vy[i]+dy/d*v));
 }
}
// Mean speed of the liquid in px/s, from a sample of its particles.
export function meanSpeed(fluid){
 let sum=0,count=0;for(let i=0;i<fluid.n;i+=37){sum+=Math.hypot(fluid.vx[i],fluid.vy[i]);count++;}
 return count?sum/count:0;
}
// Whether the liquid has come to rest: mean speed below `limit` px/s.
export function isCalm(fluid,limit=25){return meanSpeed(fluid)<limit;}
// The particles of one drop, `size` lattice steps across, at a random spot
// of the letters' lowest edge (by their targets); empty for an empty fluid.
export function dripIndices(fluid,size,random=Math.random){
 let lowest=-Infinity;for(let i=0;i<fluid.n;i++)if(fluid.ty[i]>lowest)lowest=fluid.ty[i];
 const bottom=[];for(let i=0;i<fluid.n;i++)if(fluid.ty[i]>=lowest-fluid.spacing*2.5)bottom.push(i);
 if(!bottom.length)return [];
 const seed=bottom[Math.floor(random()*bottom.length)],sx=fluid.tx[seed],sy=fluid.ty[seed],r=fluid.spacing*size;
 const indices=[];for(let i=0;i<fluid.n;i++)if(Math.hypot(fluid.tx[i]-sx,fluid.ty[i]-sy)<r)indices.push(i);
 return indices;
}
// A settling phase blends extra parameters in for a moment and fades them
// out toward the end, e.g. thin flow while letters condense or a stronger
// pull home after a burst, without a jolt when it ends. A key the base
// parameters lack (a factor such as homing) blends from 1.
export class Settle{
 constructor(){this.until=0;this.duration=0;this.extra=null;}
 start(now,ms,extra){this.until=now+ms;this.duration=ms;this.extra=extra;}
 params(base,now){
  if(now>=this.until)return base;
  const k=Math.min(1,(this.until-now)/Math.max(1,this.duration)*1.6),out={...base};
  for(const key in this.extra)out[key]=base[key]===undefined?1+(this.extra[key]-1)*k:base[key]+(this.extra[key]-base[key])*k;
  return out;
 }
}
// Where an invisible hand drifting around `centre` ({x, y, rx, ry}) is after
// `s` seconds: a slow loop that never quite repeats.
export const idleHand=(centre,s)=>({x:centre.x+Math.cos(s*.45)*centre.rx,y:centre.y+Math.sin(s*.7)*centre.ry});
