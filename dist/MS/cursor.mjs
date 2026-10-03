// The pointer's liquid drop. A short chain of drops hangs on springs behind
// the pointer and is drawn as one smooth outline. It swells while the
// pointer moves and slowly shrinks when it rests. Near the liquid letters a
// drop melts into them: its outline draws in while a solid drop of the same
// size grows inside the liquid, with two smaller drops bridging to the
// nearest point of a letter. Moving away reverses it.
//
// DropChain holds the motion (pure, testable); DropOutline draws the outline
// with one WebGL shader on a transparent canvas.

const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

export class DropChain{
 // o: count, follow (spring per step), wobble (velocity kept per step),
 // rest (size while still, share of full), decay (energy kept per step),
 // taper (last drop this much smaller), reach and overlap (melting starts
 // `reach` radii from a letter, completes `overlap` radii into it), melt
 // speeds (share per step) in and out. reach 0 switches melting off.
 constructor(o={}){
  this.o={count:6,follow:.15,wobble:.4,rest:.05,decay:.995,taper:.7,reach:4,overlap:1.5,meltIn:.33,meltOut:.33,...o};
  this.drops=[];this.energy=0;this.presence=0;this.moving=0;this.melting=false;this.ptr={x:NaN,y:NaN,on:false};this.last={x:NaN,y:NaN};this.acc=0;
 }
 point(x,y){this.ptr.x=x;this.ptr.y=y;this.ptr.on=true;}
 leave(){this.ptr.on=false;}
 // Advances dt seconds in fixed steps of 1/60 s, the same at any frame
 // rate. Returns whether the drop still changes: with the pointer there it
 // rests once it has stopped, shrunk to its resting size and finished
 // melting, and wakes with the next move; without, once it has faded.
 advance(dt,near=null,radius=0){
  this.acc=Math.min(this.acc+dt,.1);
  while(this.acc>=1/60){this.moving=this.step(near,radius);this.acc-=1/60;}
  if(this.ptr.on)return this.moving>.05||this.energy>.01||this.presence<.99||this.melting;
  return this.moving>.05||this.presence>.01;
 }
 step(near,radius){
  const o=this.o,n=Math.max(1,Math.round(o.count)),p=this.ptr;
  while(this.drops.length<n){const prev=this.drops[this.drops.length-1];this.drops.push({x:prev?prev.x:p.x,y:prev?prev.y:p.y,vx:0,vy:0,melt:0});}
  this.drops.length=n;
  if(p.on){
   if(this.drops[0].x!==this.drops[0].x)for(const d of this.drops)Object.assign(d,{x:p.x,y:p.y,vx:0,vy:0});
   const speed=this.last.x===this.last.x?Math.hypot(p.x-this.last.x,p.y-this.last.y):0;
   this.last.x=p.x;this.last.y=p.y;
   const target=Math.min(1,speed/22);
   this.energy=target>this.energy?this.energy+(target-this.energy)*.3:this.energy*o.decay;
  }else{this.last.x=this.last.y=NaN;this.energy*=o.decay;}
  this.presence+=((p.on?1:0)-this.presence)*(p.on?.15:.06);
  let moving=0;
  for(let i=0;i<n;i++){
   const d=this.drops[i],lead=i?this.drops[i-1]:null;
   const tx=lead?lead.x:p.on?p.x:d.x,ty=lead?lead.y:p.on?p.y:d.y;
   const k=Math.min(.9,o.follow*(i?1-.25*i/n:1.4));
   d.vx=(d.vx+(tx-d.x)*k)*o.wobble;d.vy=(d.vy+(ty-d.y)*k)*o.wobble;
   d.x+=d.vx;d.y+=d.vy;moving+=Math.abs(d.vx)+Math.abs(d.vy);
  }
  if(radius>0)this.melt(near,radius);
  return moving;
 }
 // Full radius of drop i for the largest radius R.
 size(i,R){
  const o=this.o,n=this.drops.length,scale=this.presence*(o.rest+(1-o.rest)*Math.min(1,this.energy));
  return R*scale*(1-o.taper*(n>1?i/(n-1):0));
 }
 melt(near,R){
  const o=this.o;this.melting=false;
  this.drops.forEach((d,i)=>{
   const full=this.size(i,R);let target=0;
   const nb=near&&o.reach>0&&full>.3?near(d.x,d.y):null;
   if(nb)target=1-smooth(-full*o.overlap,full*o.reach+2,nb.d-full);
   d.melt+=(target-d.melt)*Math.min(1,target>d.melt?o.meltIn:o.meltOut);
   if(d.melt<.001)d.melt=0;
   if(Math.abs(target-d.melt)>.002)this.melting=true;
   d.near=nb?{x:nb.x,y:nb.y}:null;
  });
 }
 // The outline (drops with their remaining radius) and the solid part
 // melting into the letters (each melting drop plus two bridge drops).
 shape(R,bridge=1){
  const outline=[],solid=[];
  this.drops.forEach((d,i)=>{
   const full=this.size(i,R),p=smooth(0,1,d.melt);
   const r=full*(1-p);if(r>.3)outline.push({x:d.x,y:d.y,r});
   // Below a pixel a solid drop would only show as a speck.
   if(full*p>1&&d.near){
    solid.push({x:d.x,y:d.y,r:full*p});
    // The original's goo blur swallows small bridge drops until they can
    // join drop and letter; drawn without that blur, they only grow in
    // once the drop has come close, so no loose dots show on the way.
    const join=smooth(.35,.85,p);
    for(let k=1;k<=2;k++){const t=k*.36,r=full*p*(.62-.12*k)*bridge*join;if(r>.75)solid.push({x:d.x+(d.near.x-d.x)*t,y:d.y+(d.near.y-d.y)*t,r});}
   }
  });
  return {outline,solid,scale:this.presence*(this.o.rest+(1-this.o.rest)*Math.min(1,this.energy))};
 }
}

const MAX=12;
const VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS=`precision highp float;
uniform vec2 res;
uniform float dpr;
uniform vec3 drops[${MAX}];
uniform int count;
uniform float merge;
uniform float width;
uniform vec3 ink;
// Smooth minimum: the drops' circles melt into one contour.
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y)/dpr;
 float d=1e5;
 for(int i=0;i<${MAX};i++){if(i>=count)break;d=smin(d,length(p-drops[i].xy)-drops[i].z,merge);}
 float aa=.75/dpr,hw=width*.5;
 float line=(1.-smoothstep(hw-aa,hw+aa,abs(d)))*clamp(width+.35,0.,1.);
 gl_FragColor=vec4(ink*line,line);
}`;

export class DropOutline{
 constructor(canvas){
  const gl=canvas.getContext('webgl',{premultipliedAlpha:true,antialias:false,alpha:true});
  if(!gl)throw new Error('WebGL fehlt');
  this.gl=gl;this.canvas=canvas;this.w=0;this.h=0;this.dpr=1;this.shown=false;
  const make=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const prog=gl.createProgram();gl.attachShader(prog,make(gl.VERTEX_SHADER,VS));gl.attachShader(prog,make(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  this.at=Object.fromEntries(['res','dpr','drops','count','merge','width','ink'].map(n=>[n,gl.getUniformLocation(prog,n)]));
  this.data=new Float32Array(MAX*3);gl.clearColor(0,0,0,0);
 }
 resize(w,h,dpr){
  this.w=w;this.h=h;this.dpr=dpr;
  this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
  this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
 }
 clear(){const gl=this.gl;if(!this.shown)return;gl.disable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT);this.shown=false;}
 // drops: [{x,y,r}] in CSS px of the viewport; merge: smooth-minimum radius.
 draw(drops,merge,width,ink){
  const gl=this.gl;this.clear();
  const list=drops.slice(0,MAX);if(!list.length)return;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  list.forEach((d,i)=>{this.data[i*3]=d.x;this.data[i*3+1]=d.y;this.data[i*3+2]=d.r;x0=Math.min(x0,d.x-d.r);y0=Math.min(y0,d.y-d.r);x1=Math.max(x1,d.x+d.r);y1=Math.max(y1,d.y+d.r);});
  // Only the box around the drop is drawn.
  const m=merge*.5+width+4,s=this.dpr;
  const sx=Math.max(0,Math.floor((x0-m)*s)),sy=Math.max(0,Math.floor((this.h-y1-m)*s));
  const sw=Math.min(this.canvas.width,Math.ceil((x1+m)*s))-sx,sh=Math.min(this.canvas.height,Math.ceil((this.h-y0+m)*s))-sy;
  if(sw<=0||sh<=0)return;
  gl.enable(gl.SCISSOR_TEST);gl.scissor(sx,sy,sw,sh);
  const at=this.at;
  gl.uniform2f(at.res,this.canvas.width,this.canvas.height);gl.uniform1f(at.dpr,s);
  gl.uniform3fv(at.drops,this.data);gl.uniform1i(at.count,list.length);
  gl.uniform1f(at.merge,Math.max(.01,merge));gl.uniform1f(at.width,width);gl.uniform3fv(at.ink,ink);
  gl.drawArrays(gl.TRIANGLES,0,3);this.shown=true;
 }
}
