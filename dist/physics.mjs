// Pixel-space, fixed-step fluid approximation: local pressure, cohesion and viscosity.
// The target spring is intentionally artistic: it lets liquid remember its glyph.
export class Fluid {
 constructor(points,width,height,spacing=6){
  this.width=width;this.height=height;this.spacing=spacing;this.n=points.length;this.time=0;
  for(const k of ['x','y','vx','vy','tx','ty','ax','ay'])this[k]=new Float32Array(this.n);
  points.forEach((p,i)=>{this.x[i]=this.tx[i]=p.x;this.y[i]=this.ty[i]=p.y;});
  this.h=spacing*2.4;this.cols=Math.ceil(width/this.h)+1;this.rows=Math.ceil(height/this.h)+1;
  this.head=new Int32Array(this.cols*this.rows);this.next=new Int32Array(this.n);
 }
 reset(){this.x.set(this.tx);this.y.set(this.ty);this.vx.fill(0);this.vy.fill(0);this.time=0;}
 impulse(x,y,dx,dy,radius){
  dx=Math.max(-650,Math.min(650,dx));dy=Math.max(-650,Math.min(650,dy));
  for(let i=0;i<this.n;i++){const d=Math.hypot(this.x[i]-x,this.y[i]-y);if(d<radius){const w=(1-d/radius)**2;this.vx[i]=Math.max(-1500,Math.min(1500,this.vx[i]+dx*w));this.vy[i]=Math.max(-1500,Math.min(1500,this.vy[i]+dy*w));}}
 }
 // Optional p.gravityX / p.gravityY (px/s²) apply a uniform external force,
 // for example from a phone's tilt and shake. Zero or missing means none.
 step(dt,p,pointer=null){
  dt=Math.max(0,Math.min(1/60,dt));if(!dt)return;this.time+=dt;
  const {n,x,y,vx,vy,ax,ay,tx,ty,h,cols,rows,head,next,spacing:s}=this;
  const gx=p.gravityX||0,gy=p.gravityY||0;
  head.fill(-1);
  const brush=pointer?.down?pointer:null;
  for(let i=0;i<n;i++){
   const c=Math.max(0,Math.min(cols-1,Math.floor(x[i]/h))),r=Math.max(0,Math.min(rows-1,Math.floor(y[i]/h)));const k=c+r*cols;next[i]=head[k];head[k]=i;
   const b=brush?Math.max(0,1-Math.hypot(x[i]-brush.x,y[i]-brush.y)/brush.radius):0;
   const homeDistance=Math.hypot(tx[i]-x[i],ty[i]-y[i]);
   const spring=(22+230*Math.exp(-homeDistance*homeDistance/(s*s*12)))*(1-.98*b);ax[i]=(tx[i]-x[i])*spring;ay[i]=(ty[i]-y[i])*spring;
   if(brush){ax[i]+=(brush.x-x[i])*b*22*p.strength;ay[i]+=(brush.y-y[i])*b*22*p.strength;}
  }
  for(let i=0;i<n;i++){
   const c=Math.floor(x[i]/h),r=Math.floor(y[i]/h);
   for(let ry=Math.max(0,r-1);ry<=Math.min(rows-1,r+1);ry++)for(let cx=Math.max(0,c-1);cx<=Math.min(cols-1,c+1);cx++){
    for(let j=head[cx+ry*cols];j!==-1;j=next[j]){
     if(j<=i)continue;
     let dx=x[j]-x[i],dy=y[j]-y[i],d2=dx*dx+dy*dy;if(d2>=h*h)continue;
     if(d2<.0001){dx=(i%2?1:-1)*.01;dy=.007;d2=dx*dx+dy*dy;}
     const d=Math.sqrt(d2),q=1-d/h,nx=dx/d,ny=dy/d;
     const pressure=d<s*.93?-650*(s*.93-d):0;
     const cohesion=(28+85*p.tension+70*p.attraction)*q;
     const f=pressure+cohesion;
     const visc=(.25+3*p.viscosity)*q;
     const rx=tx[j]-tx[i],ry=ty[j]-ty[i],rd=Math.hypot(rx,ry);
     let restX=0,restY=0;
     if(rd>.0001&&rd<h){
      const restForce=(rd<s*.93?-650*(s*.93-rd):0)+(28+85*p.tension+70*p.attraction)*(1-rd/h);
      restX=rx/rd*restForce;restY=ry/rd*restForce;
     }
     const fx=nx*f-restX+(vx[j]-vx[i])*visc,fy=ny*f-restY+(vy[j]-vy[i])*visc;
     ax[i]+=fx;ay[i]+=fy;ax[j]-=fx;ay[j]-=fy;
    }
   }
  }
  const damping=Math.exp(-(1.05+p.viscosity*3.4)*dt);
  for(let i=0;i<n;i++){
   vx[i]=Math.max(-1600,Math.min(1600,(vx[i]+(ax[i]+gx)*dt)*damping));vy[i]=Math.max(-1600,Math.min(1600,(vy[i]+(ay[i]+gy)*dt)*damping));
   x[i]+=vx[i]*dt;y[i]+=vy[i]*dt;
   if(x[i]<s){x[i]=s;vx[i]=Math.abs(vx[i])*.3;}else if(x[i]>this.width-s){x[i]=this.width-s;vx[i]=-Math.abs(vx[i])*.3;}
   if(y[i]<s){y[i]=s;vy[i]=Math.abs(vy[i])*.3;}else if(y[i]>this.height-s){y[i]=this.height-s;vy[i]=-Math.abs(vy[i])*.3;}
  }
 }
}

