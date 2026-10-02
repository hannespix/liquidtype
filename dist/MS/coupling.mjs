// Coupling between a plucked line and the liquid. Pure functions, no DOM.
// The line is a quadratic Bézier from (0,top) over the control point
// (width*anchor, top+2*offset) to (width,top); its sag at parameter t is
// 4(1-t)t*offset, so the peak displacement equals `offset`.

// Bézier parameter for a horizontal position x on the line.
export function curveParameter(width,anchor,x){
 const a=width*anchor,b=width-2*a;
 let t;
 if(Math.abs(b)<1e-6)t=x/Math.max(1e-6,2*a);
 else t=(-2*a+Math.sqrt(Math.max(0,4*a*a+4*b*x)))/(2*b);
 return t<0?0:t>1?1:t;
}
// Weight of the sag at x: 0 at both ends, 1 where the line is pulled furthest.
export function sagWeight(width,anchor,x){const t=curveParameter(width,anchor,x);return 4*(1-t)*t;}

// Keeps the liquid above the line. `line` is in fluid coordinates:
// top (rest height), width, anchor (0..1), offset (px, positive = down),
// rate (offset change in px/s) and shift (added to fluid x to get line x).
// Particles that are pushed carry the line's velocity. Returns how many
// particles press on the line (load) and the summed speed with which
// particles hit it this step (impact, px/s), both for the caller to feed back.
export function restrain(fluid,line){
 const {x,y,vy,n}=fluid,{top,width,anchor,offset,rate,shift=0}=line;
 const lowest=top+Math.min(0,offset);
 let load=0,impact=0;
 for(let i=0;i<n;i++){
  if(y[i]<lowest)continue;
  const k=sagWeight(width,anchor,x[i]+shift),ly=top+k*offset;
  if(y[i]<ly)continue;
  const lv=k*rate;
  load++;y[i]=ly;
  if(vy[i]>lv){impact+=(vy[i]-lv)*k;vy[i]=lv-(vy[i]-lv)*.2;}
 }
 return {load,impact};
}
