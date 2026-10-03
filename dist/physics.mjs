// Pixel-space, fixed-step fluid approximation: local pressure, cohesion and viscosity.
// The target spring is intentionally artistic: it lets liquid remember its glyph.
export class Fluid {
 constructor(points,width,height,spacing=6){
  this.width=width;this.height=height;this.spacing=spacing;this.n=points.length;this.time=0;
  // free[i] in 0..1 releases a particle from its glyph spring; released
  // particles feel p.dripGravity instead, so drops can fall and be recaptured.
  for(const k of ['x','y','vx','vy','tx','ty','ax','ay','free'])this[k]=new Float32Array(this.n);
  points.forEach((p,i)=>{this.x[i]=this.tx[i]=p.x;this.y[i]=this.ty[i]=p.y;});
  this.h=spacing*2.4;this.cols=Math.ceil(width/this.h)+1;this.rows=Math.ceil(height/this.h)+1;
  // Neighbour grid as sorted cells: the particles of cell c lie together in
  // `order`, from start[c] to start[c+1]. Contiguous cells are faster to walk
  // than linked lists, which counts on slow and old devices.
  const cells=this.cols*this.rows;
  this.start=new Int32Array(cells+1);this.fillAt=new Int32Array(cells);this.cell=new Int32Array(this.n);this.order=new Int32Array(this.n);
 }
 reset(){this.x.set(this.tx);this.y.set(this.ty);this.vx.fill(0);this.vy.fill(0);this.free.fill(0);this.time=0;}
 // Uniform velocity change for the whole liquid, slightly varied over the
 // glyph so a shake sloshes instead of shifting the letters as one block.
 nudge(dx,dy){
  dx=Math.max(-800,Math.min(800,dx));dy=Math.max(-800,Math.min(800,dy));
  for(let i=0;i<this.n;i++){const k=.75+.25*Math.sin(this.tx[i]*.013+this.ty[i]*.011);this.vx[i]=Math.max(-1500,Math.min(1500,this.vx[i]+dx*k));this.vy[i]=Math.max(-1500,Math.min(1500,this.vy[i]+dy*k));}
 }
 impulse(x,y,dx,dy,radius){
  dx=Math.max(-650,Math.min(650,dx));dy=Math.max(-650,Math.min(650,dy));
  for(let i=0;i<this.n;i++){const d=Math.hypot(this.x[i]-x,this.y[i]-y);if(d<radius){const w=(1-d/radius)**2;this.vx[i]=Math.max(-1500,Math.min(1500,this.vx[i]+dx*w));this.vy[i]=Math.max(-1500,Math.min(1500,this.vy[i]+dy*w));}}
 }
 // Optional p.gravityX / p.gravityY (px/s²) apply a uniform external force,
 // for example from a phone's tilt and shake. Zero or missing means none.
 // Optional p.homing scales the spring toward the glyph (1 = as designed).
 // Optional p.solo skips all neighbour forces: every particle only follows
 // its own spring, which is cheap enough for many thousands of particles.
 // Optional p.drag (1/s) adds damping, e.g. to replace the inner friction
 // that solo particles lack so they arrive without overshooting.
 step(dt,p,pointer=null){
  dt=Math.max(0,Math.min(1/60,dt));if(!dt)return;this.time+=dt;
  const {n,x,y,vx,vy,ax,ay,tx,ty,free,h,cols,rows,start,fillAt,cell,order,spacing:s}=this;
  const gx=p.gravityX||0,gy=p.gravityY||0,drip=p.dripGravity||0,homing=p.homing||1;
  const solo=!!p.solo,cells=cols*rows;if(!solo)start.fill(0);
  const brush=pointer?.down?pointer:null;
  for(let i=0;i<n;i++){
   if(!solo){const c=Math.max(0,Math.min(cols-1,Math.floor(x[i]/h)))+Math.max(0,Math.min(rows-1,Math.floor(y[i]/h)))*cols;cell[i]=c;start[c+1]++;}
   const bx=x[i]-(brush?brush.x:0),by=y[i]-(brush?brush.y:0);
   const b=brush?Math.max(0,1-Math.sqrt(bx*bx+by*by)/brush.radius):0;
   const hx=tx[i]-x[i],hy=ty[i]-y[i];
   const spring=(22+230*Math.exp(-(hx*hx+hy*hy)/(s*s*12)))*homing*(1-.98*b)*(1-free[i]);ax[i]=hx*spring;ay[i]=hy*spring+drip*free[i];
   if(brush){ax[i]+=(brush.x-x[i])*b*22*p.strength;ay[i]+=(brush.y-y[i])*b*22*p.strength;}
  }
  if(!solo){
   for(let c=0;c<cells;c++){start[c+1]+=start[c];fillAt[c]=start[c];}
   for(let i=0;i<n;i++)order[fillAt[cell[i]]++]=i;
   const h2=h*h,core=s*.93,bond=28+85*p.tension+70*p.attraction,thick=.25+3*p.viscosity;
   // Forces between two particles within reach; i is the lower index.
   const pair=(a,b)=>{
    const i=a<b?a:b,j=a<b?b:a;
    let dx=x[j]-x[i],dy=y[j]-y[i],d2=dx*dx+dy*dy;if(d2>=h2)return;
    if(d2<.0001){dx=(i%2?1:-1)*.01;dy=.007;d2=dx*dx+dy*dy;}
    const d=Math.sqrt(d2),q=1-d/h,nx=dx/d,ny=dy/d;
    const f=(d<core?-650*(core-d):0)+bond*q;
    const visc=thick*q;
    const rx=tx[j]-tx[i],ry=ty[j]-ty[i],rd=Math.sqrt(rx*rx+ry*ry);
    let restX=0,restY=0;
    if(rd>.0001&&rd<h){
     const restForce=(rd<core?-650*(core-rd):0)+bond*(1-rd/h);
     restX=rx/rd*restForce;restY=ry/rd*restForce;
    }
    const fx=nx*f-restX+(vx[j]-vx[i])*visc,fy=ny*f-restY+(vy[j]-vy[i])*visc;
    ax[i]+=fx;ay[i]+=fy;ax[j]-=fx;ay[j]-=fy;
   };
   // Every pair once: within the cell, then the cell to the right and the
   // three cells below.
   for(let cy=0;cy<rows;cy++)for(let cx=0;cx<cols;cx++){
    const c=cx+cy*cols,a0=start[c],a1=start[c+1];if(a0===a1)continue;
    const right=cx+1<cols,down=cy+1<rows,below=c+cols;
    for(let ai=a0;ai<a1;ai++){
     const a=order[ai];
     for(let k=ai+1;k<a1;k++)pair(a,order[k]);
     if(right)for(let k=start[c+1],e=start[c+2];k<e;k++)pair(a,order[k]);
     if(down){
      if(cx>0)for(let k=start[below-1],e=start[below];k<e;k++)pair(a,order[k]);
      for(let k=start[below],e=start[below+1];k<e;k++)pair(a,order[k]);
      if(right)for(let k=start[below+1],e=start[below+2];k<e;k++)pair(a,order[k]);
     }
    }
   }
  }
  const damping=Math.exp(-(1.05+p.viscosity*3.4+(p.drag||0))*dt);
  for(let i=0;i<n;i++){
   vx[i]=Math.max(-1600,Math.min(1600,(vx[i]+(ax[i]+gx)*dt)*damping));vy[i]=Math.max(-1600,Math.min(1600,(vy[i]+(ay[i]+gy)*dt)*damping));
   x[i]+=vx[i]*dt;y[i]+=vy[i]*dt;
   if(x[i]<s){x[i]=s;vx[i]=Math.abs(vx[i])*.3;}else if(x[i]>this.width-s){x[i]=this.width-s;vx[i]=-Math.abs(vx[i])*.3;}
   if(y[i]<s){y[i]=s;vy[i]=Math.abs(vy[i])*.3;}else if(y[i]>this.height-s){y[i]=this.height-s;vy[i]=-Math.abs(vy[i])*.3;}
  }
 }
}

