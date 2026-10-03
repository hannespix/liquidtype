// Phone motion readings to directions on the screen. Pure functions, no DOM.
//
// The spec's device frame has x to the right and y to the top of the phone
// held upright; a phone at rest reads +9.8 m/s² "up". Real devices differ:
// iOS reports the opposite signs, and some devices and browsers turn the
// axes by a quarter (with the screen, or because the device's natural
// orientation is landscape). People hold a phone with the page upright,
// though, so a steady reading of a clearly tilted phone shows where the
// screen's bottom lies for this device. `Upright` learns that once and turns
// every later reading by the quarter turns that point gravity down the screen.
// `MotionReader` turns the readings into what the liquid feels.

// Direction the liquid moves on the screen (x right, y down) for a device
// reading (x, y), given the screen's rotation in degrees: opposite to the
// device's own acceleration.
export function screenDirection(x,y,angle=0){
 const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {x:-(x*c-y*s),y:x*s+y*c};
}
// Turn a screen vector by q quarter turns clockwise (x right, y down).
export function quarter(v,q){
 switch(((q%4)+4)%4){
  case 1:return {x:-v.y,y:v.x};
  case 2:return {x:-v.x,y:-v.y};
  case 3:return {x:v.y,y:-v.x};
  default:return {x:v.x,y:v.y};
 }
}
// Quarter turns that point the screen vector v (where a resting reading
// lets the liquid fall) down the screen.
export function quarterToDown(v){
 let best=0,most=-Infinity;
 for(let q=0;q<4;q++){const d=quarter(v,q).y;if(d>most){most=d;best=q;}}
 return best;
}
// Learns the quarter turns from resting readings: `need` steady readings in a
// row, each tilted at least `min` m/s² out of flat (about 25°), none more than
// `jitter` m/s² from the running mean. `turn` stays null until then.
export class Upright{
 constructor({need=10,min=4.2,jitter=2.5}={}){this.need=need;this.min=min;this.jitter=jitter;this.forget();}
 forget(){this.turn=null;this.count=0;this.x=0;this.y=0;}
 add(x,y,angle=0){
  if(this.turn!==null)return this.turn;
  const v=screenDirection(x,y,angle),m=Math.hypot(v.x,v.y);
  const steady=!this.count||Math.hypot(v.x-this.x/this.count,v.y-this.y/this.count)<=this.jitter;
  if(m<this.min||!steady){this.count=0;this.x=this.y=0;if(m<this.min)return null;}
  this.x+=v.x;this.y+=v.y;this.count++;
  if(this.count>=this.need)this.turn=quarterToDown({x:this.x,y:this.y});
  return this.turn;
 }
 // A reading as a direction on the screen, corrected once learned.
 direction(x,y,angle=0){return quarter(screenDirection(x,y,angle),this.turn??0);}
}

// Turns device motion readings into what the liquid feels. Only changes
// count: a shake (linear acceleration) or a quick tilt (the change of the
// gravity direction) becomes a velocity change in px/s, and a faint lean
// toward a new tilt relaxes within `relax` seconds, so holding the phone
// still in any position does nothing lasting. Each push is limited to
// `limit` px/s. Readings move nothing until the alignment is learned, or
// the phone lay flat for `wait` ms; it is learned anew after `relearn()`.
export class MotionReader{
 constructor({relax=2,limit=260,wait=1500}={}){this.relax=relax;this.limit=limit;this.wait=wait;this.upright=new Upright();this.since=null;this.reset();}
 reset(){this.gravity=null;this.pose=null;this.last=0;}
 relearn(){this.upright.forget();this.since=null;}
 // One devicemotion event at `now` ms with the screen turned by `angle`
 // degrees. gains: shake (px per metre), tilt (px/s per m/s² of turn), lean
 // (px/s² per m/s²). Null for an unusable reading; otherwise the push
 // (`nudge`, px/s), the `lean` (px/s²), whether the alignment is known, the
 // linear acceleration and the raw reading. The first reading only sets
 // the baseline (`first`).
 read(e,now,angle,gains){
  const g=e.accelerationIncludingGravity;
  if(!g||g.x==null||g.y==null)return null;
  const dt=this.last?Math.min(.1,(now-this.last)/1000):0;this.last=now;
  if(this.since===null)this.since=now;
  this.upright.add(g.x,g.y,angle);
  const aligned=this.upright.turn!==null||now-this.since>this.wait;
  const none={x:0,y:0};
  if(!this.gravity){this.gravity={x:g.x,y:g.y};this.pose={x:g.x,y:g.y};return {first:true,aligned,nudge:none,lean:none,linear:none,g};}
  const before={x:this.gravity.x,y:this.gravity.y},fast=1-Math.exp(-dt*10),slow=1-Math.exp(-dt/this.relax);
  this.gravity.x+=(g.x-before.x)*fast;this.gravity.y+=(g.y-before.y)*fast;
  this.pose.x+=(this.gravity.x-this.pose.x)*slow;this.pose.y+=(this.gravity.y-this.pose.y)*slow;
  const a=e.acceleration,ax=a&&a.x!=null?a.x:g.x-this.gravity.x,ay=a&&a.y!=null?a.y:g.y-this.gravity.y;
  const dir=(x,y)=>this.upright.direction(x,y,angle),clamp=v=>Math.max(-this.limit,Math.min(this.limit,v));
  const shake=dir(ax,ay),turn=dir(this.gravity.x-before.x,this.gravity.y-before.y),lean=dir(this.gravity.x-this.pose.x,this.gravity.y-this.pose.y);
  return {first:false,aligned,
   nudge:{x:clamp(shake.x*gains.shake*dt+turn.x*gains.tilt),y:clamp(shake.y*gains.shake*dt+turn.y*gains.tilt)},
   lean:{x:lean.x*gains.lean,y:lean.y*gains.lean},linear:{x:ax,y:ay},g};
 }
}
