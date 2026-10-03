// Matthias Sütterlin study: the initials M and S run on the Liquid Type engine.
import {Fluid} from '../physics.mjs?v=c8b3c27e';
import {FluidRenderer} from '../render.mjs?v=c8b3c27e';
import {sampleGlyphs,glyphMaterial,glyphLattice,glyphRaster,rasterLattice} from '../glyphs.mjs?v=c8b3c27e';
import {matchPoints} from './match.mjs?v=c8b3c27e';
import {restrain,sagWeight} from './coupling.mjs?v=c8b3c27e';
import {createQuality} from '../quality.mjs?v=c8b3c27e';
import {Upright} from './sensors.mjs?v=c8b3c27e';
import {DropChain,DropOutline} from './cursor.mjs?v=c8b3c27e';

const $=id=>document.getElementById(id);
const home=$('home'),canvas=$('liquid'),initials=$('initials'),back=$('back'),crumb=$('crumb'),hint=$('hint'),hintText=$('hintText'),motionButton=$('motionButton');
const letters=[...initials.querySelectorAll('.initial')];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
// The sweet spot: heavy and cohesive, but still alive. Viscosity below
// honey so waves, drips and bursts settle within a couple of seconds.
const parameters={viscosity:.55,tension:.7,attraction:.85,strength:1.8,gravityX:0,gravityY:0,dripGravity:1400};
const pointer={x:0,y:0,down:false,radius:80,id:null,last:0,startX:0,startY:0,dragged:false};
// Every effect's dials. Adjustable live from the tuning panel (bottom left)
// and remembered in this browser; `defaults` restores them.
const defaults={
 // Idle: after this quiet time an invisible hand drifts around the initials.
 idleDelay:4000,idleForce:1.4,
 // Letters condense from a cloud this wide (share of the shorter canvas
 // side); while condensing the liquid flows thin for assembleMs.
 assembleSpread:.22,assembleMs:2200,
 // Holding gathers the liquid, then it bursts; the spring lets go briefly.
 holdMs:450,burstSpeed:1200,burstFreeMs:300,
 // Drops detach from the lowest edge every few quiet seconds.
 dripMin:6000,dripMax:11000,dripFallMs:1300,dripSize:2.3,
 // A hovering mouse between M and S draws the liquid of both toward it.
 magnetStrength:2.2,magnetRadius:.26,
 // The home line: resting liquid bends it, landing drops kick it.
 lineLoadGain:40,lineImpactGain:.05,
 // Phone sensors: px/s per m/s² for shaking and quick tilts, px/s² of
 // faint gravity toward a new lean.
 shakeGain:650,tiltGain:90,leanGain:120,
 // Flight between initials and headings: duration, viscosity and how much
 // harder the liquid is pulled to its target so it stands still at hand-over.
 morphMs:1100,morphViscosity:.7,morphHoming:5,
 // Extra pull toward the target while a flight settles (times morphHoming,
 // growing with the calm phase), so even the finest drops arrive on time.
 morphSettle:3,
 // Text grid: invisible strings every gridSpacing letter sizes that the
 // letters ride; their swing (stiffness, damping) and how hard scrolling
 // plucks them.
 gridSpacing:.2,gridStiffness:150,gridDamping:2.2,gridScroll:1.6,
 // On the sub pages, where the text is read, the strings are calm: a
 // grabbed string follows only pagePull of the pointer's pull, lets go
 // after pageSnap string spacings, settles quickly (pageStiffness,
 // pageDamping) and scrolling plucks it with pageScroll, at most
 // pageScrollMax string spacings. Links and buttons there never move.
 pageStiffness:240,pageDamping:11,pagePull:.22,pageSnap:.5,pageScroll:.35,pageScrollMax:.12,
 // Drops in motion may draw smaller than at rest (1 = full size).
 dropShrink:1,
 // In a page transition every moving drop reaches flightReach times as far
 // as at rest, with a field of flightDensity times the strength: the liquid
 // keeps the stroke weight of the type, and neighbouring drops still join
 // into one connected liquid. Outside transitions the drops stay as they are.
 // When the particle budget coarsens the lattice, the reach shrinks and the
 // field strengthens with it, so the weight holds on phones as well.
 flightReach:.9,flightDensity:.55,
 // Share of a flight after which the liquid fades into its crisp resting
 // look, and the share by which that is complete.
 calmFrom:.7,calmTo:.92,
 // Page transitions sample every font on its own lattice, sized from the
 // measured stroke width: latticePerStroke lattice steps per stroke, within
 // [latticeMin, latticeMax] px. Thin or small type thus flies as fine drops,
 // bold and large type as fuller ones. dropScale sets the drawn drop against
 // its lattice (1 = like the initials).
 latticePerStroke:.6,latticeMin:.7,latticeMax:6,dropScale:1,
 // How soon in a flight the drops reach their target size (share of it).
 sizeLead:.35,
 // Most particles a page transition may use (half on narrow screens).
 // Flights skip neighbour forces, so this can be generous.
 flightParticles:36000,
 // Extra damping in flight (1/s): without neighbour friction the drops
 // would otherwise swing past their targets.
 morphDrag:26,
 // The pointer's liquid drop: cursorDrops drops on springs behind the
 // pointer (cursorFollow stiffness, cursorWobble velocity kept per step),
 // radius cursorSize × letter size and cursorRest of that while still,
 // cursorDecay how slowly it shrinks back, cursorTaper how much smaller the
 // tail is, cursorMerge how far the drops melt into one outline of cursorLine px.
 cursorSize:.08,cursorRest:.05,cursorDrops:6,cursorFollow:.15,cursorWobble:.4,cursorDecay:.995,cursorTaper:.7,cursorMerge:3,cursorLine:1,
 // Melting into the letters: begins meltReach drop radii away, complete
 // meltOverlap radii inside; how fast it melts in and drains out; size of
 // the bridge drops toward the letter.
 meltReach:4,meltOverlap:1.5,meltIn:.33,meltOut:.33,meltBridge:1,
};
const tune={...defaults};
const CALM_SPEED=25,LINE_LOAD_MAX=600,LINE_KICK_MAX=400;
let renderer=null,fluid=null,w=0,h=0,last=0,accumulator=0,layoutKey='',rebuildTimer=0;
let idleSince=performance.now(),suppressClickUntil=0,ghost=null,centre=null,homeLine=null,lineLoad=0,lineKick=0;
let holdTimer=0,burstUntil=0,drip=null,nextDrip=performance.now()+tune.dripMin,liquidArea=null,magnetOn=false,letterSize=200;
// A settling phase blends extra parameters in for a moment and fades them
// out toward the end, e.g. thin flow while the letters assemble or a
// stronger pull home after a burst, without a jolt when it ends.
const settle={until:0,duration:0,extra:null};
function settleFor(ms,extra){settle.until=performance.now()+ms;settle.duration=ms;settle.extra=extra;}
function settling(t){
 const k=Math.min(1,(settle.until-t)/Math.max(1,settle.duration)*1.6);
 const out={...parameters};for(const key in settle.extra)out[key]=parameters[key]===undefined?1+(settle.extra[key]-1)*k:parameters[key]+(settle.extra[key]-parameters[key])*k;
 return out;
}
const magnet={x:0,y:0,down:true,radius:0};
const darkScheme=matchMedia('(prefers-color-scheme: dark)');
const isHome=()=>home.classList.contains('is-active');
// The page explains nothing; visitors find out by trying. The line under the
// letters only reports when motion sensors turn out to be unavailable.
function setHint(note){hintText.textContent=note||'';hint.hidden=!note;scheduleGrid();}
// Paper and ink follow the stylesheet, including its dark scheme.
function cssColor(name){
 const value=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const m=value.match(/^#([0-9a-f]{6})$/i);
 return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)/255):null;
}
const colors=()=>({paper:cssColor('--paper')||[1,1,1],ink:cssColor('--ink')||[0,0,0]});

// ---------------------------------------------------------------- liquid ---
// Quality dials for slow and old devices (see quality.mjs): drawing
// resolution and the share of particles, for the initials and for flights.
let quality=null;
function createRenderer(){
 try{
  renderer=new FluidRenderer(canvas,colors());w=h=0;home.classList.remove('no-liquid');
  quality??=createQuality(renderer.gl,{floatSurface:renderer.floatSurface,onChange:applyQuality});renderer.maxScale=quality.resolution;
 }
 catch(error){console.warn('Liquid Type:',error);renderer=null;home.classList.add('no-liquid');}
}
// A slow device turned a dial down: draw fewer pixels at once, or rebuild
// the initials from fewer particles (flights pick the new share up next time).
function applyQuality({changed}){
 if(!renderer)return;
 if(changed==='resolution'){renderer.maxScale=quality.resolution;if(w&&h){renderer.resize(w,h);draw();}}
 else if(isHome()&&!transition){layoutKey='';rebuild(true);}
}
// Where the (transparent) DOM letters sit, relative to the canvas.
function glyphLayout(){
 const box=canvas.getBoundingClientRect();
 return letters.map(el=>{
  const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
  return {char:el.textContent.trim(),x:r.left-box.left,y:r.top-box.top,width:r.width,height:r.height,size:parseFloat(cs.fontSize),font:`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`};
 });
}
// Paint the glyphs into their (transparent) buttons. The cap height is centred
// in the line box and M and S share one baseline, so the pair sits optically
// in the middle of its hit area instead of on the low CSS baseline.
function paint(g,layout){
 g.fillStyle='black';g.textAlign='left';g.textBaseline='alphabetic';
 for(const l of layout){
  g.font=l.font;
  const cap=g.measureText('M').actualBoundingBoxAscent||l.size*.7;
  g.fillText(l.char,l.x,l.y+(l.height+cap)/2);
 }
}
function rebuild(force=false){
 if(!renderer||!isHome()||transition)return;
 if(!fitCanvas())return;
 const layout=glyphLayout();
 const key=[w,h,...layout.map(l=>[l.x,l.y,l.height,l.font].join())].join('|');
 if(!force&&key===layoutKey&&fluid)return;
 layoutKey=key;
 const {points,spacing,material}=sampleInitials(layout);
 renderer.setMaterial(material);
 const old=fluid;fluid=new Fluid(points,w,h,spacing);
 // A rebuild mid-flight (font load, resize) keeps the liquid where it was.
 if(old?.n)for(let i=0;i<fluid.n;i++){
  const j=Math.min(old.n-1,Math.floor(i*old.n/fluid.n));
  fluid.x[i]=clampX(fluid.tx[i]+old.x[j]-old.tx[j]);fluid.y[i]=clampY(fluid.ty[i]+old.y[j]-old.ty[j]);fluid.vx[i]=old.vx[j];fluid.vy[i]=old.vy[j];
 }
 drip=null;burstUntil=0;
 const left=Math.min(...layout.map(l=>l.x)),right=Math.max(...layout.map(l=>l.x+l.width));
 const size=layout[0]?.size||200;
 centre={x:(left+right)/2,y:layout[0]?layout[0].y+layout[0].height/2:h/2,rx:(right-left)*.42,ry:size*.3};
 pointer.radius=Math.max(50,Math.min(110,size*.32));
 // The magnet works wherever the mouse is over the liquid letters: the area
 // of their ink, widened by half the magnet's reach.
 const reach=size*tune.magnetRadius*.5;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const p of points){if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y;}
 liquidArea=points.length?{left:x0-reach,right:x1+reach,top:y0-reach,bottom:y1+reach}:null;
 letterSize=size;
 ghost=null;draw();
}
function fitCanvas(){
 const box=canvas.getBoundingClientRect(),nw=Math.round(box.width),nh=Math.round(box.height);
 if(nw<2||nh<2)return false;
 if(nw!==w||nh!==h){w=nw;h=nh;renderer.resize(w,h);}
 return true;
}
const sampleInitials=layout=>sampleGlyphs(w,h,g=>paint(g,layout),Math.round((w<700?2200:4200)*(quality?.particles??1)));
const clampX=v=>Math.max(fluid.spacing,Math.min(w-fluid.spacing,v));
const clampY=v=>Math.max(fluid.spacing,Math.min(h-fluid.spacing,v));
// The letters condense from scattered drops instead of simply appearing.
function scatter(){
 if(!fluid||reducedMotion.matches)return;
 const r=Math.min(w,h)*tune.assembleSpread;
 for(let i=0;i<fluid.n;i++){
  const a=Math.random()*Math.PI*2,d=r*Math.sqrt(Math.random());
  fluid.x[i]=clampX(fluid.tx[i]+Math.cos(a)*d);fluid.y[i]=clampY(fluid.ty[i]+Math.sin(a)*d);fluid.vx[i]=fluid.vy[i]=0;
 }
 idleSince=performance.now();settleFor(tune.assembleMs,{viscosity:.3,attraction:.5,homing:2});
}
// Everything flies away from the press point; the spring lets go for a moment.
function burst(x,y){
 if(!fluid)return;
 const R=Math.max(w,h),now=performance.now();
 for(let i=0;i<fluid.n;i++){
  const dx=fluid.x[i]-x,dy=fluid.y[i]-y,d=Math.hypot(dx,dy)||1,f=1-d/R;
  if(f<=0)continue;
  const speed=tune.burstSpeed*Math.sqrt(f)*(.8+.4*Math.random());
  fluid.vx[i]=Math.max(-1500,Math.min(1500,fluid.vx[i]+dx/d*speed));fluid.vy[i]=Math.max(-1500,Math.min(1500,fluid.vy[i]+dy/d*speed));
 }
 if(!reducedMotion.matches){fluid.free.fill(1);burstUntil=now+tune.burstFreeMs;drip=null;}
 pointer.down=false;pointer.dragged=true;suppressClickUntil=now+600;idleSince=now;
 settleFor(tune.burstFreeMs+2600,{homing:2.5});
 try{navigator.vibrate?.(20);}catch{/* optional */}
}
function calm(){let sum=0,count=0;for(let i=0;i<fluid.n;i+=37){sum+=Math.hypot(fluid.vx[i],fluid.vy[i]);count++;}return count===0||sum/count<CALM_SPEED;}
function startDrip(t){
 let lowest=0;for(let i=0;i<fluid.n;i++)if(fluid.ty[i]>lowest)lowest=fluid.ty[i];
 const bottom=[];for(let i=0;i<fluid.n;i++)if(fluid.ty[i]>=lowest-fluid.spacing*2.5)bottom.push(i);
 if(!bottom.length)return;
 const seed=bottom[Math.floor(Math.random()*bottom.length)],sx=fluid.tx[seed],sy=fluid.ty[seed],r=fluid.spacing*tune.dripSize;
 const indices=[];for(let i=0;i<fluid.n;i++)if(Math.hypot(fluid.tx[i]-sx,fluid.ty[i]-sy)<r){indices.push(i);fluid.free[i]=1;}
 drip={indices,until:t+tune.dripFallMs};
}
function effects(t){
 if(burstUntil&&t>burstUntil){fluid.free.fill(0);burstUntil=0;}
 if(drip){if(t>drip.until){for(const i of drip.indices)fluid.free[i]=0;drip=null;nextDrip=t+tune.dripMin+Math.random()*Math.max(0,tune.dripMax-tune.dripMin);}}
 else if(t>nextDrip){if(!reducedMotion.matches&&!pointer.down&&!burstUntil&&calm())startDrip(t);else nextDrip=t+800;}
}
function scheduleRebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>rebuild(),120);}
// 0 during a flight, rising smoothly to 1 between calmFrom and calmTo.
function flightCalm(){
 if(!transition?.ms)return 0;
 const k=(performance.now()-transition.start)/transition.ms,c=Math.max(0,Math.min(1,(k-tune.calmFrom)/Math.max(.01,tune.calmTo-tune.calmFrom)));
 return c*c*(3-2*c);
}
function draw(){
 if(!renderer||!fluid)return;
 // The thin flight look applies to every drop, only while a page changes.
 // A lattice coarsened by the budget reaches less far with a stronger field.
 const coarse=Math.sqrt(transition?.coarse||1);
 renderer.dropShrink=tune.dropShrink;renderer.fine=transition?{from:1e4,to:1e4+1,grow:tune.flightReach/coarse,amp:tune.flightDensity*coarse*coarse}:{from:0,to:0,grow:1,amp:1};
 // Toward the end of a flight the liquid settles into crisp type on cue.
 renderer.calm=flightCalm();
 // The pointer's drop melting into the letters is drawn with the liquid.
 renderer.extra=isHome()&&!transition?cursorSolid:null;
 renderer.draw(fluid);
}
function local(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function disturb(x,y,dx,dy,radius){if(fluid&&Math.abs(dx)+Math.abs(dy)>=.1)fluid.impulse(x,y,dx,dy,radius);}

home.addEventListener('pointerdown',e=>{
 if(!fluid||transition||pointer.id!==null||e.button>0||e.target.closest('a, .link, .line-hit, .motion-pill'))return;
 const p=local(e);
 Object.assign(pointer,{x:p.x,y:p.y,startX:e.clientX,startY:e.clientY,down:true,id:e.pointerId,last:performance.now(),dragged:false});
 idleSince=performance.now();magnetOn=false;
 clearTimeout(holdTimer);holdTimer=setTimeout(()=>{if(pointer.down&&!pointer.dragged)burst(pointer.x,pointer.y);},tune.holdMs);
});
home.addEventListener('contextmenu',e=>{if(e.target.closest('.initial, .liquid'))e.preventDefault();});
window.addEventListener('pointermove',e=>{
 if(!fluid||!isHome()||transition||(pointer.id!==null&&e.pointerId!==pointer.id)||(!pointer.down&&e.target?.closest?.('.tune, .tune-toggle')))return;
 if(pointer.down&&e.pointerType==='mouse'&&e.buttons===0)release(e);
 const p=local(e),now=performance.now();
 if(pointer.last){
  const dx=p.x-pointer.x,dy=p.y-pointer.y;
  if(pointer.down)disturb(p.x,p.y,dx*16*parameters.strength,dy*16*parameters.strength,pointer.radius);
  else if(e.pointerType==='mouse'&&Math.hypot(dx,dy)<100)disturb(p.x,p.y,dx*2.5*parameters.strength,dy*2.5*parameters.strength,pointer.radius*.65);
 }
 if(pointer.down&&!pointer.dragged&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>8){pointer.dragged=true;clearTimeout(holdTimer);}
 magnetOn=!pointer.down&&e.pointerType==='mouse'&&!!liquidArea&&p.x>liquidArea.left&&p.x<liquidArea.right&&p.y>liquidArea.top&&p.y<liquidArea.bottom;
 magnet.x=p.x;magnet.y=p.y;
 pointer.x=p.x;pointer.y=p.y;pointer.last=now;idleSince=now;
},{passive:true});
function release(e){
 if(pointer.id===null||(e&&e.pointerId!==pointer.id))return;
 // A drag that ends on a letter must not also open "Über mich".
 if(pointer.dragged)suppressClickUntil=Math.max(suppressClickUntil,performance.now()+400);
 clearTimeout(holdTimer);pointer.down=false;pointer.id=null;pointer.dragged=false;
}
window.addEventListener('pointerup',release);
window.addEventListener('pointercancel',release);
document.documentElement.addEventListener('pointerleave',()=>{if(!pointer.down)pointer.last=0;magnetOn=false;});
initials.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.stopPropagation();e.preventDefault();}},true);
// Arrow keys on a focused letter send a wave through the liquid.
initials.addEventListener('keydown',e=>{
 const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
 if(!dir||!fluid||!centre||transition)return;
 e.preventDefault();idleSince=performance.now();
 fluid.impulse(centre.x,centre.y,dir[0]*420,dir[1]*420,Math.max(w,h));
});
// After a quiet moment an invisible hand drifts around the initials.
function idleMotion(t){
 if(reducedMotion.matches||pointer.down||!centre||t-idleSince<tune.idleDelay){ghost=null;return;}
 const s=(t-idleSince-tune.idleDelay)/1000;
 const x=centre.x+Math.cos(s*.45)*centre.rx,y=centre.y+Math.sin(s*.7)*centre.ry;
 if(ghost)disturb(x,y,(x-ghost.x)*tune.idleForce*parameters.strength,(y-ghost.y)*tune.idleForce*parameters.strength,pointer.radius*.6);
 ghost={x,y};
}
function frame(t){
 requestAnimationFrame(frame);
 if(document.hidden||(!isHome()&&!transition)){last=0;return;}
 // Flights are cheap (no neighbour forces) and must arrive on time, so they
 // may catch up more simulated time per frame on a slow device. With fewer
 // particles chosen for a slow processor, the liquid at home no longer
 // catches up a late frame in full: it briefly slows instead of stuttering.
 const cap=transition?.1:(quality?.level.part??0)>=2?1/40:.04;
 const interval=last?t-last:0,dt=Math.min(cap,interval/1000);last=t;
 const work=performance.now();
 // The home line runs on the same clock as the liquid, so both can push each other.
 if(isHome()){homeLine?.step(dt,Math.min(LINE_LOAD_MAX,lineLoad)*tune.lineLoadGain,lineKick);lineKick=0;}
 if(!fluid||!renderer)return;
 settleMotion(t);
 accumulator=Math.min(cap,accumulator+dt);
 if(transition){
  // In flight between initials and heading: plain, thicker physics so the
  // liquid is calm when the real heading takes over; nothing else.
  // Without neighbour forces and with strong drag, steps of 1/60 s stay
  // stable, which halves the cost of the many fine drops.
  const flight={...parameters,viscosity:tune.morphViscosity,homing:tune.morphHoming*(1+tune.morphSettle*flightCalm()),solo:true,drag:tune.morphDrag};
  while(accumulator>=1/60){fluid.step(1/60,flight,null);accumulator-=1/60;}
  blendSizes(t);draw();quality?.frame(interval,performance.now()-work);return;
 }
 idleMotion(t);effects(t);
 if(accumulator>=1/120){
  const box=canvas.getBoundingClientRect(),shape=homeLine?.shape();
  const line=shape&&{top:shape.top-box.top,width:shape.width,anchor:shape.anchor,offset:shape.offset,rate:shape.rate,shift:box.left};
  magnet.radius=letterSize*tune.magnetRadius;
  const brush=pointer.down?pointer:magnetOn&&!reducedMotion.matches?magnet:null;
  const prm=brush===magnet?{...parameters,strength:tune.magnetStrength}:t<settle.until?settling(t):parameters;
  while(accumulator>=1/120){
   fluid.step(1/120,prm,brush);
   if(line){const hit=restrain(fluid,line);lineLoad=hit.load;lineKick+=Math.min(LINE_KICK_MAX,hit.impact*tune.lineImpactGain);}
   accumulator-=1/120;
  }
 }
 cursorSync(t);
 draw();
 quality?.frame(interval,performance.now()-work);
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;fluid=null;home.classList.add('no-liquid');});
canvas.addEventListener('webglcontextrestored',()=>{createRenderer();rebuild(true);});
darkScheme.addEventListener('change',()=>{const c=colors();renderer?.setColors(c.paper,c.ink);cursorInk=c.ink;draw();cursorKick();});
new ResizeObserver(scheduleRebuild).observe(document.getElementById('views'));
new ResizeObserver(scheduleRebuild).observe(initials);
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;release({pointerId:pointer.id});resetMotion();quality?.reset();});

// ----------------------------------------------------------------- motion ---
// Phone sensors. Only changes count: a shake or a quick tilt sends the liquid
// off; holding the phone still in any position does nothing lasting. Device
// acceleration (m/s²) becomes liquid velocity (px/s): tune.shakeGain
// integrates linear acceleration (px per metre), tune.tiltGain scales the
// change of the gravity direction per event, tune.leanGain is a faint force
// toward the tilt that relaxes within LEAN_RELAX seconds.
const LEAN_RELAX=2,NUDGE_LIMIT=260,SENSOR_TIMEOUT=300,SENSOR_WAIT=2500;
const motion={active:false,gravity:null,pose:null,last:0,events:0,waiting:0,since:0};
// Sensor axes differ between devices and browsers (see sensors.mjs): the
// phone's own resting readings tell which way is down on the screen. Learned
// anew whenever the screen turns.
const upright=new Upright(),UPRIGHT_WAIT=1500;
const screenAngle=()=>screen.orientation?.angle??window.orientation??0;
const relearnUpright=()=>{upright.forget();motion.since=0;};
screen.orientation?.addEventListener?.('change',relearnUpright);window.addEventListener('orientationchange',relearnUpright);
const debug=new URLSearchParams(location.search).has('debug')?Object.assign(document.body.appendChild(document.createElement('pre')),{className:'debug'}):null;
// With ?debug the running simulation is reachable from the console for tuning.
if(debug)window.liquidType={get fluid(){return fluid;},get drip(){return drip;},get parameters(){return parameters;},get motion(){return motion;},get renderer(){return renderer;},get transition(){return transition;},get quality(){return quality;},get cursor(){return chain;}};
// Device reading to the direction the liquid moves on the canvas (x right,
// y down): opposite to the device's own acceleration, aligned with the screen.
const liquidDirection=(x,y)=>upright.direction(x,y,screenAngle());
const clampNudge=v=>Math.max(-NUDGE_LIMIT,Math.min(NUDGE_LIMIT,v));
function onMotion(e){
 const g=e.accelerationIncludingGravity;
 if(!g||g.x==null||g.y==null)return;
 const now=performance.now(),dt=motion.last?Math.min(.1,(now-motion.last)/1000):0;motion.last=now;motion.events++;
 if(!motion.active){motion.active=true;clearTimeout(motion.waiting);motionButton.hidden=true;setHint();}
 // Until the alignment is known the readings move nothing; a phone lying flat
 // keeps the standard alignment after a moment.
 if(!motion.since)motion.since=now;
 upright.add(g.x,g.y,screenAngle());
 const aligned=upright.turn!==null||now-motion.since>UPRIGHT_WAIT;
 if(!motion.gravity){motion.gravity={x:g.x,y:g.y};motion.pose={x:g.x,y:g.y};return;}
 const before={x:motion.gravity.x,y:motion.gravity.y},fast=1-Math.exp(-dt*10),slow=1-Math.exp(-dt/LEAN_RELAX);
 motion.gravity.x+=(g.x-before.x)*fast;motion.gravity.y+=(g.y-before.y)*fast;
 motion.pose.x+=(motion.gravity.x-motion.pose.x)*slow;motion.pose.y+=(motion.gravity.y-motion.pose.y)*slow;
 const a=e.acceleration,ax=a&&a.x!=null?a.x:g.x-motion.gravity.x,ay=a&&a.y!=null?a.y:g.y-motion.gravity.y;
 const shake=liquidDirection(ax,ay),turn=liquidDirection(motion.gravity.x-before.x,motion.gravity.y-before.y),lean=liquidDirection(motion.gravity.x-motion.pose.x,motion.gravity.y-motion.pose.y);
 const dx=clampNudge(shake.x*tune.shakeGain*dt+turn.x*tune.tiltGain),dy=clampNudge(shake.y*tune.shakeGain*dt+turn.y*tune.tiltGain);
 if(aligned&&fluid&&isHome()&&!document.hidden&&Math.hypot(dx,dy)>1.5){fluid.nudge(dx,dy);idleSince=now;}
 parameters.gravityX=aligned?lean.x*tune.leanGain:0;parameters.gravityY=aligned?lean.y*tune.leanGain:0;
 if(debug)debug.textContent=`sensor aktiv · ${motion.events} ereignisse · ausrichtung ${upright.turn===null?(aligned?'standard':'lernt'):upright.turn*90+'°'} · bildschirm ${screenAngle()}°\na ${ax.toFixed(2)} ${ay.toFixed(2)}  g ${g.x.toFixed(2)} ${g.y.toFixed(2)} ${(g.z??0).toFixed(2)}\nschub ${dx.toFixed(0)} ${dy.toFixed(0)} px/s  lehnen ${parameters.gravityX.toFixed(0)} ${parameters.gravityY.toFixed(0)}`;
}
// Without fresh sensor data the lean must not linger.
function settleMotion(t){if(motion.last&&t-motion.last>SENSOR_TIMEOUT)parameters.gravityX=parameters.gravityY=0;}
function resetMotion(){parameters.gravityX=parameters.gravityY=0;motion.gravity=null;motion.last=0;}
function startMotion(){
 window.removeEventListener('devicemotion',onMotion);window.addEventListener('devicemotion',onMotion,{passive:true});
 if(debug&&!motion.active)debug.textContent='sensor angefragt, warte auf ereignisse …';
}
// Tapping the button is the user gesture iOS needs, and on every phone it
// tells within a moment whether the browser delivers motion data at all.
function requestMotion(){
 clearTimeout(motion.waiting);
 const ask=typeof DeviceMotionEvent.requestPermission==='function'?DeviceMotionEvent.requestPermission():Promise.resolve('granted');
 ask.then(state=>{
  if(state!=='granted'){motionButton.hidden=true;setHint('Der Browser hat die Bewegungsdaten nicht freigegeben.');return;}
  startMotion();
  motion.waiting=setTimeout(()=>{if(!motion.active){motionButton.hidden=true;setHint('Dieser Browser liefert keine Bewegungsdaten.');}},SENSOR_WAIT);
 }).catch(()=>{motionButton.hidden=true;setHint('Bewegungsdaten sind hier nicht verfügbar.');});
}
const touchDevice=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
const motionPossible=touchDevice&&'DeviceMotionEvent' in window&&!reducedMotion.matches;
if(motionPossible){
 motionButton.hidden=false;
 motionButton.addEventListener('click',requestMotion);
 // Android delivers without asking; the button disappears as soon as data arrives.
 if(typeof DeviceMotionEvent.requestPermission!=='function')startMotion();
}else if(debug)debug.textContent=`kein sensor: touch ${touchDevice} · api ${'DeviceMotionEvent' in window} · reduzierte bewegung ${reducedMotion.matches}`;

// ---------------------------------------------------------------- cursor ---
// The pointer's liquid drop (see cursor.mjs): an outline that follows the
// pointer everywhere and, near the liquid letters, melts into them as solid
// ink drawn with the liquid itself, so it truly flows together with M and S.
// On the home page the liquid's own frame drives it, so the drop follows the
// liquid wherever it is (dragged, burst, dripping); on the text pages it runs
// on its own and sleeps while the pointer rests.
const coarsePointer=matchMedia('(pointer: coarse)').matches;
const chain=new DropChain(),cursorCanvas=document.createElement('canvas');
let cursorOutline=null,cursorRaf=0,cursorThen=0,cursorSolid=[],cursorInk=colors().ink;
try{cursorCanvas.className='cursor-drop';cursorCanvas.setAttribute('aria-hidden','true');cursorOutline=new DropOutline(cursorCanvas);document.body.append(cursorCanvas);}catch{cursorOutline=null;}
function cursorFit(){if(cursorOutline){const w=document.documentElement.clientWidth,h=innerHeight;cursorCanvas.style.width=w+'px';cursorCanvas.style.height=h+'px';cursorOutline.resize(w,h,Math.min(2,devicePixelRatio||1));}}
function cursorTick(t){
 cursorRaf=0;
 const dt=cursorThen?Math.min(.1,(t-cursorThen)/1000):1/60;cursorThen=t;
 Object.assign(chain.o,{count:tune.cursorDrops,follow:tune.cursorFollow,wobble:tune.cursorWobble,rest:tune.cursorRest,decay:tune.cursorDecay,taper:tune.cursorTaper,reach:tune.meltReach,overlap:tune.meltOverlap,meltIn:tune.meltIn,meltOut:tune.meltOut});
 // A finger covers small drops: on touch screens they stay bigger.
 const R=Math.max(coarsePointer?34:18,letterSize*tune.cursorSize);
 // Nearest drop of the liquid as it is right now, in viewport px, and the
 // distance to its surface (half a lattice step outside the drop's centre);
 // only while the letters are on show. A few thousand drops are cheap to
 // scan, and the drop then melts into the letters wherever they flow.
 const liquid=cursorTarget(),box=liquid?canvas.getBoundingClientRect():null;
 const near=liquid?(x,y)=>{
  const cx=x-box.left,cy=y-box.top,{x:px,y:py,n}=liquid;let best=-1,least=Infinity;
  for(let i=0;i<n;i++){const dx=px[i]-cx,dy=py[i]-cy,d2=dx*dx+dy*dy;if(d2<least){least=d2;best=i;}}
  return best<0?null:{d:Math.max(0,Math.sqrt(least)-liquid.spacing*.5),x:px[best]+box.left,y:py[best]+box.top};
 }:null;
 const alive=chain.advance(dt,near,R),{outline,solid,scale}=chain.shape(R,tune.meltBridge);
 cursorOutline.draw(outline,R*scale*tune.cursorMerge,tune.cursorLine,cursorInk);
 cursorSolid=box?solid.map(d=>({x:d.x-box.left,y:d.y-box.top,r:d.r})):[];
 if(alive)cursorRaf=requestAnimationFrame(cursorTick);
 else{cursorThen=0;if(!chain.ptr.on){cursorOutline.clear();cursorSolid=[];}}
}
// The liquid the drop may melt into: only while the letters are on show.
function cursorTarget(){return isHome()&&!transition&&fluid?.n?fluid:null;}
// Called by the liquid's frame right before it draws: steps the drop in the
// same frame, so the part melting into the letters moves with them and shows
// together with its outline, as long as the drop is there at all.
function cursorSync(t){
 if(!cursorOutline||reducedMotion.matches)return;
 if(cursorRaf){cancelAnimationFrame(cursorRaf);cursorTick(t);}
 else if(cursorTarget()&&(chain.ptr.on||chain.presence>.01))cursorTick(t);
}
function cursorKick(){if(cursorOutline&&!reducedMotion.matches&&!cursorRaf)cursorRaf=requestAnimationFrame(cursorTick);}
function cursorAt(x,y){chain.point(x,y);cursorKick();}
function cursorAway(){chain.leave();cursorKick();}
if(cursorOutline){
 // A new canvas size clears the outline, so it is drawn again.
 cursorFit();window.addEventListener('resize',()=>{cursorFit();cursorKick();},{passive:true});
 window.addEventListener('pointermove',e=>cursorAt(e.clientX,e.clientY),{passive:true});
 window.addEventListener('pointerdown',e=>cursorAt(e.clientX,e.clientY),{passive:true});
 document.documentElement.addEventListener('pointerleave',cursorAway,{passive:true});
 window.addEventListener('blur',cursorAway,{passive:true});
 // While the page scrolls under a finger, pointer events stop but touch events go on.
 window.addEventListener('touchmove',e=>{const t=e.touches[0];if(t)cursorAt(t.clientX,t.clientY);},{passive:true});
 const touchEnd=e=>{if(!e.touches.length)cursorAway();};
 window.addEventListener('touchend',touchEnd,{passive:true});window.addEventListener('touchcancel',touchEnd,{passive:true});
}

// ------------------------------------------------------------ navigation ---
const views=new Map([...document.querySelectorAll('.view')].map(v=>[v.dataset.view,v]));
const parents={about:'home',projects:'home',contact:'home',fernen:'projects',adac:'projects',dreamco:'projects'};
const baseTitle=document.title;
// Opening a section, the initials flow into its text (tune.morphMs), then the
// real heading and text take over (FADE_MS). Coming back, the heading flows
// into the initials.
const FADE_MS=350;
let current=null,transition=null,homeEntry=null;
function viewFromHash(){const name=decodeURIComponent(location.hash.slice(1));return views.has(name)?name:'home';}
function chrome(name){
 const label=views.get(name).getAttribute('aria-label');
 back.hidden=name==='home';crumb.textContent=label;
 document.title=name==='home'?baseTitle:`${label} — Matthias Sütterlin`;
}
const canMorph=()=>!!renderer&&!reducedMotion.matches&&!home.classList.contains('no-liquid');
// A displayed view's whole text (heading, paragraphs, facts, links) as a
// drawing in page coordinates, which equal the liquid canvas coordinates.
// Every word is placed where the browser laid it out, in its own font, so
// wrapped headings and body text match line for line; null when not laid out.
// A flight plays at the top of the page, so only words that start within the
// first screen (and a little more) take part; the rest fades in with the page.
function textShape(view){
 const panel=view.querySelector('.panel');if(!panel)return null;
 const reach=innerHeight*1.15;
 const styles=new Map(),words=[],walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const el=node.parentElement;if(!el||el.closest('.line'))continue;
  let style=styles.get(el);
  if(!style){const cs=getComputedStyle(el);style={font:`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,spacing:cs.letterSpacing,upper:cs.textTransform==='uppercase',px:parseFloat(cs.fontSize)||16};styles.set(el,style);}
  for(const m of node.data.matchAll(/\S+/g)){
   const range=document.createRange();range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);
   const r=range.getBoundingClientRect();
   if(r.width>0&&r.height>0&&r.top+scrollY<reach)words.push({text:style.upper?m[0].toUpperCase():m[0],x:r.left+scrollX,top:r.top+scrollY,width:r.width,height:r.height,style});
  }
 }
 if(!words.length)return null;
 // Words grouped by font (size, weight, family), each with the box it occupies.
 const groups=new Map();
 for(const w of words){
  const px=w.style.px,key=w.style.font;let gr=groups.get(key);
  if(!gr){gr={key,px,box:{x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity}};groups.set(key,gr);}
  const pad=px*.3;gr.box.x0=Math.min(gr.box.x0,w.x-pad);gr.box.y0=Math.min(gr.box.y0,w.top-pad);gr.box.x1=Math.max(gr.box.x1,w.x+w.width+pad);gr.box.y1=Math.max(gr.box.y1,w.top+w.height+pad);
 }
 return {groups:[...groups.values()],draw(g,onlyFont){
  g.fillStyle='black';g.textAlign='left';g.textBaseline='alphabetic';
  const metrics=new Map();
  for(const word of words){
   if(onlyFont!==undefined&&word.style.font!==onlyFont)continue;
   const st=word.style;
   let mt=metrics.get(st);
   if(!mt){g.font=st.font;const m=g.measureText('M');mt={asc:m.fontBoundingBoxAscent,desc:m.fontBoundingBoxDescent};mt.ok=Number.isFinite(mt.asc)&&Number.isFinite(mt.desc);metrics.set(st,mt);}
   g.font=st.font;if('letterSpacing' in g)g.letterSpacing=st.spacing;
   g.fillText(word.text,word.x,mt.ok?word.top+(word.height-mt.asc-mt.desc)/2+mt.asc:word.top+word.height*.78);
  }
 }};
}
const headingShape=textShape;
const canvasOn=on=>{canvas.classList.toggle('is-off',!on);};
// Flight drops skip neighbour forces and cost a fraction of a resting drop,
// so a slow device gives up fewer of them (the root of its particle share).
const panelBudget=()=>Math.round(tune.flightParticles*(w<700?.5:1)*Math.sqrt(quality?.particles??1));
// A whole text as liquid: every font on its own lattice, sized from its
// stroke width, so thin type gets fine drops and bold or large type fuller
// ones. Returns the points, each point's lattice (its drop size), the
// finest lattice and the material texture.
function sampleText(shape,budget){
 const material=glyphMaterial(w,h,g=>shape.draw(g));
 // Every font is painted once; a coarser second try only scans again.
 const rasters=shape.groups.map(gr=>glyphRaster(w,h,g=>shape.draw(g,gr.key),{box:gr.box}));
 let scale=1,points=[],sizes=[];
 for(let attempt=0;attempt<3;attempt++){
  points=[];sizes=[];
  for(const raster of rasters){
   // Cells count by the pixel under their centre, so the liquid carries the
   // type's own weight; a third covered is enough to keep thin stems whole.
   const lattice=rasterLattice(raster,stroke=>Math.max(tune.latticeMin,Math.min(tune.latticeMax,stroke*tune.latticePerStroke))*scale,{threshold:80,faithful:true});
   for(const p of lattice.points){points.push(p);sizes.push(lattice.spacing);}
  }
  if(points.length<=budget)break;
  scale*=Math.sqrt(points.length/budget)*1.03;
 }
 // The flight's physics spacing (its springs' near zone) stays at least
 // 1.5 px, so the finest drops still settle in time for the hand-over.
 return {points,sizes:Float32Array.from(sizes,s=>s*tune.dropScale),spacing:Math.max(1.5,sizes.length?sizes.reduce((a,b)=>Math.min(a,b)):0),coarse:scale,material};
}
// The liquid canvas spans #views. A flight may reach further down than the
// view on show (a long section on a phone), so #views is stretched for it.
const viewsEl=document.getElementById('views');
function reachDown(px){const need=Math.ceil(px);if(need>viewsEl.offsetHeight)viewsEl.style.minHeight=need+'px';return fitCanvas();}
function releaseHeight(){viewsEl.style.minHeight='';}
// Overlay the target view with its heading hidden, measure the heading.
function stage(view){
 view.hidden=false;view.classList.add('is-active','is-arriving');
 const shape=headingShape(view);
 if(!shape){unstage(view);return null;}
 return shape;
}
function unstage(view){view.hidden=true;view.classList.remove('is-active','is-arriving');}
// Shared tail of every morph into a non-home view: the real text fades in on
// top of the settled liquid; the canvas only switches off once it is opaque.
function handOver(fromView,view,focus){
 const t={finish(){
  for(const id of t.timers)clearTimeout(id);
  fromView.hidden=true;fromView.classList.remove('is-active','is-leaving','is-handed');
  // The page is already on show: leaving the overlay must not replay its
  // entrance animation (a fade and slide of all its text).
  view.classList.add('is-handed');
  view.classList.remove('is-arriving','is-revealed');canvas.classList.remove('is-fading');canvasOn(false);
  glideLand();transition=null;layoutKey='';releaseHeight();scheduleGrid();
  if(focus)view.querySelector('h2')?.focus({preventScroll:true});
 }};
 startTransition(t,tune.morphMs+FADE_MS+400);
 t.timers.push(setTimeout(()=>{
  if(transition!==t)return;
  view.classList.add('is-revealed');
  const panel=view.querySelector('.panel');
  panel?.addEventListener('transitionend',e=>{if(e.target===panel&&transition===t)t.finish();},{once:true});
 },tune.morphMs));
 return t;
}
function startTransition(t,ms){t.start=performance.now();t.ms=tune.morphMs;t.timers=[];transition=t;t.timers.push(setTimeout(()=>{if(transition===t)t.finish();},ms));}
// Per-particle drop sizes for a flight: `from` and `to` are arrays or one
// number each; the drawn size blends between them over the flight. `coarse`
// is how far the particle budget coarsened the text lattice (1 = not at all).
function flightSizes(t,from,to,coarse=1){
 t.coarse=coarse;
 const n=fluid.n;t.sizeFrom=new Float32Array(n);t.sizeTo=new Float32Array(n);fluid.dropSize=new Float32Array(n);
 for(let i=0;i<n;i++){t.sizeFrom[i]=typeof from==='number'?from:from[i];t.sizeTo[i]=typeof to==='number'?to:to[i];fluid.dropSize[i]=t.sizeFrom[i];}
}
function blendSizes(now){
 const t=transition;if(!t?.sizeFrom||!fluid?.dropSize)return;
 // With `t.way` (each drop's distance at the start), a drop takes its target
 // size along its own way, so it never shrinks while still far apart from its
 // neighbours. Otherwise ease out: the drops take their target size early.
 if(t.way){for(let i=0;i<fluid.n;i++){const e=1-Math.min(1,Math.hypot(fluid.x[i]-fluid.tx[i],fluid.y[i]-fluid.ty[i])/t.way[i]);fluid.dropSize[i]=t.sizeFrom[i]+(t.sizeTo[i]-t.sizeFrom[i])*e;}return;}
 const k=Math.min(1,(now-t.start)/(t.ms*tune.sizeLead)),e=1-(1-k)*(1-k);
 for(let i=0;i<fluid.n;i++)fluid.dropSize[i]=t.sizeFrom[i]+(t.sizeTo[i]-t.sizeFrom[i])*e;
}
// Home to a section: the initials, in whatever state they are, dissolve
// into the section's heading.
function morphForward(name,focus){
 if(!fluid?.n)return false;
 const view=views.get(name),shape=stage(view);
 if(!shape)return false;
 if(!reachDown(view.offsetHeight)){unstage(view);releaseHeight();return false;}
 const old=fluid,sample=sampleText(shape,panelBudget());
 if(!sample.points.length){unstage(view);releaseHeight();return false;}
 current=name;chrome(name);window.scrollTo(0,0);
 const fromLine=lineState(homeLine);
 home.classList.add('is-leaving');release({pointerId:pointer.id});magnetOn=false;drip=null;burstUntil=0;
 renderer.setMaterial(sample.material);
 fluid=new Fluid(sample.points,w,h,sample.spacing);
 const from=Array.from({length:old.n},(_,j)=>({x:old.x[j],y:old.y[j]})),pair=matchPoints(from,sample.points);
 for(let i=0;i<fluid.n;i++){const j=pair[i];fluid.x[i]=old.x[j];fluid.y[i]=old.y[j];fluid.vx[i]=old.vx[j]*.3;fluid.vy[i]=old.vy[j]*.3;}
 flightSizes(handOver(home,view,focus),old.spacing,sample.sizes,sample.coarse);
 glideStart(fromLine,viewLines.get(view));
 return true;
}
// Section to section, including project pages: the current heading flows
// into the next one. Both are sampled at heading density.
function morphBetween(from,name,focus){
 const fromView=views.get(from),src=headingShape(fromView);
 if(!src)return false;
 const view=views.get(name),dst=stage(view);
 if(!dst)return false;
 canvasOn(true);
 if(!reachDown(Math.max(fromView.offsetHeight,view.offsetHeight))){unstage(view);canvasOn(false);releaseHeight();return false;}
 const a=sampleText(src,panelBudget()),b=sampleText(dst,panelBudget());
 if(!a.points.length||!b.points.length){unstage(view);canvasOn(false);releaseHeight();return false;}
 const fromLine=lineState(viewLines.get(fromView));
 current=name;chrome(name);window.scrollTo(0,0);
 fromView.classList.add('is-leaving');
 renderer.setMaterial(b.material);
 fluid=new Fluid(b.points,w,h,b.spacing);
 const fromSizes=new Float32Array(fluid.n);
 const pair=matchPoints(a.points,b.points);
 for(let i=0;i<fluid.n;i++){const j=pair[i],p=a.points[j];fluid.x[i]=p.x;fluid.y[i]=p.y;fromSizes[i]=a.sizes[j];}
 flightSizes(handOver(fromView,view,focus),fromSizes,b.sizes,Math.max(a.coarse,b.coarse));
 glideStart(fromLine,viewLines.get(view));
 draw();
 return true;
}
// Returning home: a liquid of the heading's own density starts as the
// text and flows to the initials. For the flight the initials are sampled
// as finely as the text, so every drop has a target of its own and the
// liquid stays fine all the way; the regular initials take over at rest.
function arriveFrom({shape,height,line}){
 if(!renderer||!shape||!reachDown(height)){releaseHeight();rebuild();scatter();return;}
 const layout=glyphLayout(),ms=sampleInitials(layout);
 const sample=sampleText(shape,panelBudget());
 if(!sample.points.length||!ms.points.length){releaseHeight();rebuild();scatter();return;}
 const fine=glyphLattice(w,h,g=>paint(g,layout),Math.max(tune.latticeMin,Math.min(ms.spacing,ms.spacing*Math.sqrt(ms.points.length/sample.points.length))),{threshold:80,faithful:true});
 const targets=fine.points.length?fine.points:ms.points,size=fine.points.length?fine.spacing:ms.spacing;
 fluid=new Fluid(sample.points,w,h,Math.max(1.5,size));
 const pair=matchPoints(targets,sample.points);
 for(let i=0;i<fluid.n;i++){const p=targets[pair[i]];fluid.tx[i]=p.x;fluid.ty[i]=p.y;}
 renderer.setMaterial(ms.material);layoutKey='';
 const t={finish(){for(const id of t.timers)clearTimeout(id);glideLand();transition=null;releaseHeight();rebuild(true);}};
 startTransition(t,tune.morphMs);
 glideStart(line,homeLine);
 flightSizes(t,sample.sizes,size*tune.dropScale,sample.coarse);
 t.way=Float32Array.from({length:fluid.n},(_,i)=>Math.max(1,Math.hypot(fluid.x[i]-fluid.tx[i],fluid.y[i]-fluid.ty[i])));
 idleSince=performance.now();
}
function show(name,focus=true){
 if(!views.has(name))name='home';
 if(name===current)return;
 transition?.finish();gridReset();
 const from=current;
 if(canMorph()&&from&&from!=='home'&&name!=='home'&&morphBetween(from,name,focus))return;
 if(canMorph()&&from==='home'&&name!=='home'&&morphForward(name,focus))return;
 homeEntry=canMorph()&&name==='home'&&from&&from!=='home'?{shape:headingShape(views.get(from)),height:views.get(from).offsetHeight,line:lineState(viewLines.get(views.get(from)))}:null;
 plainShow(name,focus);
}
function plainShow(name,focus){
 current=name;
 for(const [key,view] of views){const on=key===name;view.hidden=!on;view.classList.toggle('is-active',on);view.classList.remove('is-handed');}
 chrome(name);window.scrollTo(0,0);canvasOn(name==='home');
 if(name==='home'){
  release({pointerId:pointer.id});last=0;idleSince=performance.now();resetMotion();
  const entry=homeEntry;homeEntry=null;
  requestAnimationFrame(()=>{if(entry?.shape)arriveFrom(entry);else{rebuild();scatter();}});
 }
 scheduleGrid();
 if(focus){if(name==='home')quietFocus(letters[0]);else views.get(name).querySelector('h2')?.focus({preventScroll:true});}
}
// Focus the page moves itself shows no focus mark (keyboard users still land
// on the letter); the mark returns with the next keyboard step.
function quietFocus(el){
 if(!el)return;
 el.dataset.quietFocus='';el.addEventListener('blur',()=>{delete el.dataset.quietFocus;},{once:true});
 el.focus({preventScroll:true});
}
function go(name){
 if(name===current)return;
 history.pushState(null,'',name==='home'?location.pathname+location.search:'#'+name);
 show(name);
}
document.addEventListener('click',e=>{const target=e.target.closest('[data-go]');if(target)go(target.dataset.go);});
back.addEventListener('click',()=>go(parents[current]||'home'));
window.addEventListener('popstate',()=>show(viewFromHash()));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&current!=='home')go(parents[current]||'home');});

// ------------------------------------------------------------------ tune ---
// Sliders for every dial above plus the physics parameters. Values live in
// this browser (localStorage) so a phone can be tuned across reloads.
const TUNE=[
 ['Physik','viscosity','Zähflüssigkeit',0,1,.01,parameters],['Physik','tension','Oberflächenspannung',0,1,.01,parameters],['Physik','attraction','Anziehung',0,1,.01,parameters],['Physik','strength','Impulsstärke',.1,2.1,.01,parameters],
 ['Zusammensetzen','assembleSpread','Streuung',.05,.6,.01],['Zusammensetzen','assembleMs','Dünnflüssig (ms)',0,4000,50],
 ['Halten und Platzen','holdMs','Haltedauer (ms)',150,1500,10],['Halten und Platzen','burstSpeed','Stärke',200,2000,10],['Halten und Platzen','burstFreeMs','Freiflug (ms)',0,800,10],
 ['Tropfen','dripMin','Pause mindestens (ms)',1000,20000,100],['Tropfen','dripMax','Pause höchstens (ms)',1000,30000,100],['Tropfen','dripFallMs','Fallzeit (ms)',200,4000,50],['Tropfen','dripSize','Größe',1,4,.1],['Tropfen','dripGravity','Schwerkraft',200,3000,10,parameters],
 ['Magnet','magnetStrength','Stärke',0,6,.1],['Magnet','magnetRadius','Radius',.1,.6,.01],
 ['Cursor','cursorSize','Größe',.02,.2,.005],['Cursor','cursorRest','Größe in Ruhe',0,1,.01],['Cursor','cursorDrops','Tropfen',1,12,1],['Cursor','cursorFollow','Federung',.02,.6,.01],['Cursor','cursorWobble','Nachschwingen',.1,.9,.01],['Cursor','cursorDecay','Langsam schrumpfen',.95,.999,.001],['Cursor','cursorTaper','Verjüngung',0,1,.01],['Cursor','cursorMerge','Verschmelzen',.5,6,.1],['Cursor','cursorLine','Linienstärke (px)',.5,3,.1],
 ['Cursor','meltReach','Verschmelzen ab (Radien)',0,8,.1],['Cursor','meltOverlap','Ganz verschmolzen bei (Radien)',0,4,.1],['Cursor','meltIn','Einfließen',.02,1,.01],['Cursor','meltOut','Ausfließen',.02,1,.01],['Cursor','meltBridge','Brücke',0,2,.05],
 ['Linie','lineLoadGain','Last',0,150,1],['Linie','lineImpactGain','Aufprall',0,.15,.005],
 ['Ruhebewegung','idleDelay','Verzögerung (ms)',1000,15000,100],['Ruhebewegung','idleForce','Kraft',0,4,.1],
 ['Sensoren','shakeGain','Schütteln',0,2000,10],['Sensoren','tiltGain','Kippen',0,300,1],['Sensoren','leanGain','Neigen (Schwerkraft)',0,500,5],
 ['Übergang','morphMs','Flugzeit (ms)',300,2500,50],['Übergang','morphViscosity','Zähigkeit im Flug',0,1,.01],['Übergang','morphHoming','Zug zum Ziel',1,6,.1],['Übergang','morphSettle','Nachziehen am Ende',0,6,.1],
 ['Textgitter','gridSpacing','Abstand',.1,.4,.01],['Textgitter','gridStiffness','Schwingung',30,600,5],['Textgitter','gridDamping','Dämpfung',.3,6,.1],['Textgitter','gridScroll','Scrollen',0,4,.1],
 ['Textgitter Unterseiten','pagePull','Mitziehen',0,1,.01],['Textgitter Unterseiten','pageSnap','Loslassen nach (Saitenabstände)',.1,1.4,.05],['Textgitter Unterseiten','pageStiffness','Schwingung',30,600,5],['Textgitter Unterseiten','pageDamping','Dämpfung',.3,20,.1],['Textgitter Unterseiten','pageScroll','Scrollen',0,4,.05],['Textgitter Unterseiten','pageScrollMax','Scrollen höchstens (Saitenabstände)',0,1.2,.01],
 ['Darstellung','dropShrink','Tropfen in Bewegung',.3,1,.01],
 ['Übergang','latticePerStroke','Raster je Strichstärke',.3,1.5,.05],['Übergang','latticeMin','Feinstes Raster',.5,3,.05],['Übergang','latticeMax','Gröbstes Raster',2,10,.1],['Übergang','calmFrom','Beruhigung ab (Anteil)',.3,1,.01],['Übergang','calmTo','Beruhigung bis (Anteil)',.4,1,.01],['Übergang','dropScale','Tropfengröße',.5,1.5,.05],['Übergang','sizeLead','Größenwechsel',.1,1,.05],['Übergang','flightParticles','Partikel im Flug',2000,40000,500],['Übergang','morphDrag','Dämpfung im Flug',0,40,.5],['Darstellung','flightReach','Reichweite im Flug',.3,1.5,.01],['Darstellung','flightDensity','Dichte im Flug',.2,2,.01],
];
const physicsDefaults={...parameters};
const TUNE_KEY='ms-tune';
function tuneValues(){const out={};for(const [,key,,,,,target] of TUNE)out[key]=(target||tune)[key];return out;}
function loadTune(){
 try{const saved=JSON.parse(localStorage.getItem(TUNE_KEY)||'{}');
  for(const [,key,,min,max,,target] of TUNE){const v=Number(saved[key]);if(Number.isFinite(v))(target||tune)[key]=Math.min(max,Math.max(min,v));}
 }catch{/* storage unavailable or unreadable */}
}
function saveTune(){try{localStorage.setItem(TUNE_KEY,JSON.stringify(tuneValues()));}catch{/* storage unavailable */}}
function buildTune(){
 const body=$('tuneBody'),values=$('tuneValues');if(!body)return;
 body.textContent='';let group='';
 const inputs=[];
 for(const [grp,key,label,min,max,step,target] of TUNE){
  if(grp!==group){group=grp;const h=document.createElement('div');h.className='tune-group';h.textContent=grp;body.append(h);}
  const row=document.createElement('label');row.className='tune-row';
  const name=document.createElement('span');name.textContent=label;
  const out=document.createElement('output');
  const input=document.createElement('input');input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);
  const show=()=>{const v=(target||tune)[key];input.value=String(v);input.style.setProperty('--fill',((v-min)/(max-min)*100).toFixed(1)+'%');out.value=step<1?v.toFixed(step<.01?3:2):String(Math.round(v));};
  input.addEventListener('input',()=>{(target||tune)[key]=Number(input.value);show();saveTune();values.value=JSON.stringify(tuneValues());cursorKick();});
  row.append(name,out,input);body.append(row);inputs.push(show);show();
 }
 const refresh=()=>{for(const show of inputs)show();values.value=JSON.stringify(tuneValues());};
 refresh();
 $('tuneReset').addEventListener('click',()=>{Object.assign(tune,defaults);Object.assign(parameters,physicsDefaults);try{localStorage.removeItem(TUNE_KEY);}catch{/* storage unavailable */}refresh();});
 const copy=$('tuneCopy');
 copy.addEventListener('click',()=>{
  const json=JSON.stringify(tuneValues());values.value=json;
  (navigator.clipboard?.writeText(json)||Promise.reject()).then(()=>{copy.textContent='Kopiert';setTimeout(()=>{copy.textContent='Kopieren';},1500);}).catch(()=>{panel.classList.add('has-values');values.focus();values.select();});
 });
 const toggle=$('tuneToggle'),panel=$('tune');
 const openTune=open=>{panel.classList.toggle('is-open',open);panel.inert=!open;toggle.setAttribute('aria-expanded',String(open));};
 toggle.addEventListener('click',()=>openTune(!panel.classList.contains('is-open')));
 $('tuneClose').addEventListener('click',()=>openTune(false));
 document.addEventListener('pointerdown',e=>{if(panel.classList.contains('is-open')&&!e.target.closest('.tune, .tune-toggle'))openTune(false);});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('is-open')){e.stopImmediatePropagation();openTune(false);}},true);
}
// The panel and remembered values only appear on request (?tune or ?debug);
// every other visit gets the defaults above.
const tuning=['tune','debug'].some(k=>new URLSearchParams(location.search).has(k));
if(tuning){loadTune();buildTune();}else{$('tuneToggle')?.remove();$('tune')?.remove();}

// ------------------------------------------------------------- text grid ---
// Invisible horizontal strings across the whole page, one every few letter
// sizes. Every letter is its own span and rides the two strings nearest to
// it, so when a string swings the text swings with it. Crossing a string
// with the pointer grabs it; it follows until it snaps free and swings out.
// Scrolling plucks the strings in view, a tap on empty space plucks the
// nearest one. Nothing of the grid itself is drawn. The home page swings
// freely; the sub pages, where text is read, only ripple gently, and their
// links and buttons stay put so they are easy to hit.
const SPLIT='.panel, .tagline, .hint';
const grid={lines:[],letters:[],spacing:70,oy:0,width:0,height:0,raf:0,then:0,timer:0,rest:0,ptr:{x:NaN,y:NaN},tap:null};
const gridOn=()=>!reducedMotion.matches;
function splitText(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const el=node.parentElement;
  if(node.data.trim()&&!el.closest('.gc, .line')&&!el.closest('.panel a, .panel button'))nodes.push(node);
 }
 for(const node of nodes){
  const frag=document.createDocumentFragment();
  for(const part of node.data.split(/(\s+)/)){
   if(!part)continue;
   if(/^\s+$/.test(part)){frag.append(part);continue;}
   const word=document.createElement('span');word.className='gw';
   for(const ch of part){const c=document.createElement('span');c.className='gc';c.textContent=ch;word.append(c);}
   frag.append(word);
  }
  node.replaceWith(frag);
 }
}
function gridBuild(){
 if(!gridOn())return;
 const root=document.documentElement;
 grid.spacing=Math.max(44,Math.min(90,Math.round(letterSize*tune.gridSpacing)));
 grid.width=root.clientWidth;grid.height=Math.max(innerHeight,root.scrollHeight);grid.oy=(innerHeight/2)%grid.spacing;
 const old=new Map(grid.lines.map(l=>[l.pos,l]));
 grid.lines=[];
 for(let y=grid.oy;y<=grid.height;y+=grid.spacing){const keep=old.get(y);grid.lines.push(keep||{pos:y,offset:0,velocity:0,at:.5,grabbed:false});}
 for(const el of document.querySelectorAll(SPLIT))splitText(el);
 grid.letters=[];
 for(const c of document.querySelectorAll('.gc')){
  c.style.transform='';
  if(!c.offsetParent)continue;
  const r=c.getBoundingClientRect();
  grid.letters.push({el:c,x:r.left+r.width/2+scrollX,y:r.top+scrollY+r.height*.72,dy:0});
 }
 gridKick();
}
function scheduleGrid(){clearTimeout(grid.timer);grid.timer=setTimeout(gridBuild,80);}
const lineOffset=(l,x)=>l?sagWeight(grid.width,l.at,x)*l.offset:0;
// Only letters near the screen are moved while the strings swing; the last
// pass, once all is still, settles every letter (`all`).
function gridLetters(all=false){
 const {lines,spacing,oy}=grid,top=scrollY-spacing,bottom=scrollY+innerHeight+spacing;
 for(const L of grid.letters){
  if(!all&&(L.y<top||L.y>bottom))continue;
  const fy=(L.y-oy)/spacing,i=Math.floor(fy),k=fy-i;
  const dy=lineOffset(lines[i],L.x)*(1-k)+lineOffset(lines[i+1],L.x)*k;
  if(Math.abs(dy-L.dy)>.05){L.dy=dy;L.el.style.transform=dy?`translateY(${dy.toFixed(2)}px)`:'';}
 }
}
// How the strings feel: free on the home page, calm on the sub pages.
function gridFeel(){
 return isHome()?{stiffness:tune.gridStiffness,damping:tune.gridDamping,pull:1,snap:1,scroll:tune.gridScroll,scrollMax:1.2,tap:2.4}
  :{stiffness:tune.pageStiffness,damping:tune.pageDamping,pull:tune.pagePull,snap:tune.pageSnap,scroll:tune.pageScroll,scrollMax:tune.pageScrollMax,tap:2.4*tune.pagePull};
}
function gridTick(t){
 const dt=grid.then?Math.min(1/30,(t-grid.then)/1000):1/60;grid.then=t;
 const feel=gridFeel();let busy=false;
 for(const l of grid.lines){
  if(l.grabbed){busy=true;continue;}
  if(!l.offset&&!l.velocity)continue;
  l.velocity+=-feel.stiffness*l.offset*dt;l.velocity*=Math.exp(-feel.damping*dt);l.offset+=l.velocity*dt;
  if(Math.abs(l.offset)<.1&&Math.abs(l.velocity)<2)l.offset=l.velocity=0;else busy=true;
 }
 gridLetters(!busy);
 if(busy)grid.raf=requestAnimationFrame(gridTick);else{grid.raf=0;grid.then=0;}
}
function gridKick(){if(!grid.raf)grid.raf=requestAnimationFrame(gridTick);}
const gridSnap=type=>(type==='mouse'?grid.spacing*1.4:grid.spacing*1.1)*gridFeel().snap;
function gridPointer(x,y,type){
 const px=grid.ptr.x,py=grid.ptr.y;grid.ptr.x=x;grid.ptr.y=y;
 if(px!==px)return;
 const snap=gridSnap(type),follow=gridFeel().pull;let touched=false;
 for(const l of grid.lines){
  if(!l.grabbed&&(py-l.pos)*(y-l.pos)<=0&&py!==y){l.grabbed=true;l.velocity=0;}
  if(!l.grabbed)continue;
  const pull=y-l.pos;l.at=Math.max(0,Math.min(1,x/Math.max(1,grid.width)));
  if(Math.abs(pull)>snap){gridLet(l);if(type!=='mouse')try{navigator.vibrate?.(6);}catch{/* optional */}continue;}
  l.offset=pull*follow;touched=true;
 }
 if(touched)gridKick();
 // On a sub page a resting pointer lets go, so no line stays bent while reading.
 clearTimeout(grid.rest);if(touched&&!isHome())grid.rest=setTimeout(gridRelease,250);
}
function gridLet(l){l.grabbed=false;if(Math.abs(l.offset)<.75)l.offset=0;gridKick();}
function gridRelease(){grid.ptr.x=grid.ptr.y=NaN;for(const l of grid.lines)if(l.grabbed)gridLet(l);}
function gridFlick(l,x,amp){
 if(!l||l.grabbed||Math.abs(amp)<Math.abs(l.offset)+1)return;
 l.at=Math.max(0,Math.min(1,x/Math.max(1,grid.width)));l.offset=amp;l.velocity=0;gridKick();
}
function gridReset(){
 for(const l of grid.lines){l.offset=l.velocity=0;l.grabbed=false;}
 for(const L of grid.letters){L.dy=0;L.el.style.transform='';}
 grid.ptr.x=grid.ptr.y=NaN;
}
if(gridOn()){
 window.addEventListener('pointermove',e=>{
  if(e.target?.closest?.('.tune, .tune-toggle, dialog'))return;
  // Over a link or button of a sub page the text lets go and calms down,
  // so what is about to be clicked stands still.
  if(e.target?.closest?.('.panel a, .panel button')){gridRelease();return;}
  gridPointer(e.pageX,e.pageY,e.pointerType);
 },{passive:true});
 window.addEventListener('pointerdown',e=>{grid.tap=e.pointerType!=='mouse'&&!e.target.closest('button, a, input, .tune')?{x:e.pageX,y:e.pageY,t:performance.now()}:null;},{passive:true});
 window.addEventListener('pointerup',e=>{
  if(e.pointerType!=='mouse')gridRelease();
  // A short tap on empty space plucks the nearest string under the finger.
  const tap=grid.tap;grid.tap=null;
  if(tap&&Math.hypot(e.pageX-tap.x,e.pageY-tap.y)<10&&performance.now()-tap.t<350){
   const l=grid.lines[Math.round((e.pageY-grid.oy)/grid.spacing)];
   if(l){let pull=e.pageY-l.pos;if(Math.abs(pull)<grid.spacing*.25)pull=grid.spacing*.5*(pull<0?-1:1);gridFlick(l,e.pageX,pull*gridFeel().tap);}
  }
 },{passive:true});
 window.addEventListener('pointercancel',gridRelease,{passive:true});
 document.documentElement.addEventListener('pointerleave',gridRelease,{passive:true});
 // Scrolling: the strings in view lag behind like rubber and the text rides along.
 let lastScroll=scrollY,lastScrollT=performance.now();
 window.addEventListener('scroll',()=>{
  grid.ptr.x=grid.ptr.y=NaN;
  const now=performance.now(),v=(scrollY-lastScroll)/Math.max(8,now-lastScrollT)*16;lastScroll=scrollY;lastScrollT=now;
  if(Math.abs(v)<1.5)return;
  const feel=gridFeel(),cap=grid.spacing*feel.scrollMax,top=scrollY-grid.spacing,bottom=scrollY+innerHeight+grid.spacing;
  for(const l of grid.lines){
   if(l.pos<top||l.pos>bottom)continue;
   const vary=.75+.25*Math.sin(l.pos*.05);
   gridFlick(l,grid.width*(.5+.3*Math.sin(l.pos*.013)),Math.max(-cap,Math.min(cap,v*feel.scroll))*vary);
  }
 },{passive:true});
 window.addEventListener('resize',scheduleGrid,{passive:true});
 document.fonts?.ready.then(scheduleGrid);
 scheduleGrid();
}


// ------------------------------------------------------- pluckable lines ---
const SVG='http://www.w3.org/2000/svg';
// A thin line that grabs the pointer when crossed, follows it, snaps free and
// swings out. A `driven` line is stepped by the caller instead of its own
// timer and reports its shape, so the liquid can rest on it.
function pluckable(host,driven=false){
 host.classList.add('line');host.setAttribute('aria-hidden','true');
 const svg=document.createElementNS(SVG,'svg'),path=document.createElementNS(SVG,'path'),hit=document.createElement('div');
 hit.className='line-hit';svg.append(path);host.append(svg,hit);
 const mid=200;
 let width=0,offset=0,velocity=0,rate=0,previousOffset=0,anchor=.5,grabbed=false,previous=null,raf=0,then=0;
 const snap=()=>Math.max(70,Math.min(160,innerHeight*.18));
 const clamped=()=>Math.max(-snap(),Math.min(snap(),offset));
 function render(){
  path.setAttribute('d',`M0 ${mid} Q${(width*anchor).toFixed(1)} ${(mid+clamped()*2).toFixed(1)} ${width} ${mid}`);
 }
 function fit(){
  const left=host.getBoundingClientRect().left;width=document.documentElement.clientWidth;
  for(const el of [svg,hit]){el.style.left=-left+'px';el.style.width=width+'px';}
  render();
 }
 // Damped spring; `load` is an extra downward acceleration from whatever rests
 // on the line, `kick` a downward velocity from whatever just landed on it.
 function step(dt,load=0,kick=0){
  if(!grabbed&&(offset||velocity||load||kick)){
   velocity+=(-620*offset+load)*dt+kick;velocity*=Math.exp(-4.2*dt);offset+=velocity*dt;
   if(!load&&Math.abs(offset)<.15&&Math.abs(velocity)<3)offset=velocity=0;
   render();
  }
  const now=clamped();rate=dt>0?(now-previousOffset)/dt:0;previousOffset=now;
  return grabbed||offset!==0||velocity!==0;
 }
 function swing(t){
  const dt=then?Math.min(1/30,(t-then)/1000):1/60;then=t;
  if(step(dt))raf=requestAnimationFrame(swing);else{raf=0;then=0;}
 }
 function grab(){grabbed=true;cancelAnimationFrame(raf);raf=0;then=0;velocity=0;}
 // A gliding line arrived here: this line carries on with its swing.
 function take(o,v){
  grabbed=false;anchor=.5;offset=o;velocity=v;
  if(reducedMotion.matches)offset=velocity=0;else if(!driven&&!raf&&(offset||velocity))raf=requestAnimationFrame(swing);
  render();
 }
 function letGo(){
  if(!grabbed)return;grabbed=false;
  offset=clamped();
  if(reducedMotion.matches){offset=0;render();}else if(!driven&&!raf)raf=requestAnimationFrame(swing);
 }
 function follow(e){
  if(!host.offsetParent){previous=null;return;}
  const rel=e.clientY-host.getBoundingClientRect().top;
  if(!grabbed&&previous!==null&&Math.sign(previous)!==Math.sign(rel))grab();
  previous=rel;
  if(!grabbed)return;
  anchor=Math.max(0,Math.min(1,e.clientX/Math.max(1,width)));offset=rel;
  if(Math.abs(rel)>snap())letGo();else render();
 }
 hit.addEventListener('pointerdown',e=>{grab();follow(e);});
 window.addEventListener('pointermove',follow,{passive:true});
 window.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')letGo();},{passive:true});
 window.addEventListener('pointercancel',letGo,{passive:true});
 document.documentElement.addEventListener('pointerleave',()=>{previous=null;letGo();});
 new ResizeObserver(fit).observe(host);
 window.addEventListener('resize',fit,{passive:true});
 fit();
 return {step,host,take,hide(on){host.classList.toggle('is-gliding',on);},shape(){return {top:host.getBoundingClientRect().top,width,anchor,offset:clamped(),rate};}};
}
// Every page's line, by its view.
const viewLines=new Map();
document.querySelectorAll('.panel h2').forEach(h2=>{const line=document.createElement('div');h2.after(line);viewLines.set(h2.closest('.view'),pluckable(line));});
homeLine=pluckable(document.querySelector('[data-line]'),true);viewLines.set(home,homeLine);

// While the page changes, one line glides from the line of the page on show
// to the line of the next one: eased in and out over most of the flight, and
// bending a little as if drawn through the liquid. Both real lines hide
// meanwhile; on arrival the new one takes over the glide's swing, so the
// hand-over cannot be seen.
const GLIDE_SHARE=.85,GLIDE_SPRING=420,GLIDE_DAMP=4.2,GLIDE_LAG=1.2;
const glide={svg:null,path:null,run:null};
// Page position of a line as laid out, without a view's entrance animation.
function lineTop(line){
 const view=line.host.closest('.view'),tf=view?getComputedStyle(view).transform:'none';
 return line.host.getBoundingClientRect().top+scrollY-(tf&&tf!=='none'?new DOMMatrixReadOnly(tf).m42:0);
}
const lineState=line=>line&&line.host.offsetParent?{line,y:lineTop(line),offset:line.shape().offset}:null;
function glideStart(from,to){
 glideLand();
 if(!from||!to||!to.host.offsetParent||reducedMotion.matches)return;
 if(!glide.svg){
  glide.svg=document.createElementNS(SVG,'svg');glide.path=document.createElementNS(SVG,'path');
  glide.svg.classList.add('glide-line');glide.svg.setAttribute('aria-hidden','true');glide.svg.append(glide.path);document.body.append(glide.svg);
 }
 glide.run={from:from.line,to,y0:from.y,y1:lineTop(to),m:from.offset,v:0,start:performance.now(),then:0};
 from.line.hide(true);to.hide(true);glide.svg.style.display='';
 requestAnimationFrame(glideTick);
}
function glideTick(now){
 const g=glide.run;if(!g)return;
 const dt=g.then?Math.min(1/30,(now-g.then)/1000):1/60;g.then=now;
 const ms=tune.morphMs*GLIDE_SHARE,k=Math.max(0,Math.min(1,(now-g.start)/ms));
 // Smootherstep and its acceleration: the ends ease in and out, the middle
 // lags behind them on a soft spring.
 const ease=k*k*k*(k*(6*k-15)+10),accel=k<1?(g.y1-g.y0)*60*k*(k-1)*(2*k-1)/(ms*ms/1e6):0;
 g.v+=(-GLIDE_SPRING*g.m-GLIDE_LAG*accel)*dt;g.v*=Math.exp(-GLIDE_DAMP*dt);g.m+=g.v*dt;
 const y=g.y0+(g.y1-g.y0)*ease,width=document.documentElement.clientWidth;
 glide.svg.style.width=width+'px';glide.svg.style.transform=`translateY(${(y-scrollY-200).toFixed(2)}px)`;
 glide.path.setAttribute('d',`M0 200 Q${(width/2).toFixed(1)} ${(200+g.m*2).toFixed(1)} ${width} 200`);
 requestAnimationFrame(glideTick);
}
function glideLand(){
 const g=glide.run;if(!g)return;
 glide.run=null;glide.svg.style.display='none';
 g.from.hide(false);g.to.hide(false);g.to.take(g.m,g.v);
}

// ----------------------------------------------------------------- start ---
show(viewFromHash(),false);
createRenderer();
try{await document.fonts?.load('700 100px "Playfair Display"');}catch{/* fallback serif */}
rebuild(true);
scatter();
document.fonts?.ready.then(()=>rebuild());
requestAnimationFrame(frame);
