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
