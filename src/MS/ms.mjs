// Matthias Sütterlin study: the initials M and S run on the Liquid Type engine.
import {Fluid} from '../physics.mjs';
import {FluidRenderer} from '../render.mjs';
import {sampleGlyphs} from '../glyphs.mjs';
import {restrain,sagWeight} from './coupling.mjs';

const $=id=>document.getElementById(id);
const home=$('home'),canvas=$('liquid'),initials=$('initials'),intro=$('intro'),back=$('back'),crumb=$('crumb'),hintText=$('hintText'),motionButton=$('motionButton');
const letters=[...initials.querySelectorAll('.initial')];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
// Impulse strength, attraction and viscosity at the maximum of the main page's sliders.
const parameters={viscosity:1,tension:.65,attraction:1,strength:2.1,gravityX:0,gravityY:0,dripGravity:1400};
const pointer={x:0,y:0,down:false,radius:80,id:null,last:0,startX:0,startY:0,dragged:false};
// Every effect's dials. Adjustable live from the tuning panel (bottom left)
// and remembered in this browser; `defaults` restores them.
const defaults={
 // Idle: after this quiet time an invisible hand drifts around the initials.
 idleDelay:5000,idleForce:1.6,
 // Letters condense from a cloud this wide (share of the shorter canvas
 // side); while condensing the liquid flows thin for assembleMs.
 assembleSpread:.2,assembleMs:2600,
 // Holding gathers the liquid, then it bursts; the spring lets go briefly.
 holdMs:480,burstSpeed:1100,burstFreeMs:260,
 // Drops detach from the lowest edge every few quiet seconds.
 dripMin:5000,dripMax:9000,dripFallMs:1300,dripSize:2.3,
 // A hovering mouse between M and S draws the liquid of both toward it.
 magnetStrength:2.2,magnetRadius:.26,
 // The home line: resting liquid bends it, landing drops kick it.
 lineLoadGain:40,lineImpactGain:.05,
 // Phone sensors: px/s per m/s² for shaking and quick tilts, px/s² of
 // faint gravity toward a new lean.
 shakeGain:650,tiltGain:90,leanGain:120,
 // Flight between initials and headings: duration, viscosity and how much
 // harder the liquid is pulled to its target so it stands still at hand-over.
 morphMs:1000,morphViscosity:.85,morphHoming:3,
 // Text grid: invisible strings every gridSpacing letter sizes that the
 // letters ride; their swing (stiffness, damping) and how hard scrolling
 // plucks them.
 gridSpacing:.2,gridStiffness:150,gridDamping:2.2,gridScroll:1.6,
 // Drops in motion may draw smaller than at rest (1 = full size).
 dropShrink:1,
 // In flight a particle's drop grows with the font size of its target word
 // (px per font px, capped at the initials' drop size).
 dropPerFontPx:.075,dropMax:5.5,
};
const tune={...defaults};
const CALM_SPEED=25,LINE_LOAD_MAX=600,LINE_KICK_MAX=400;
let renderer=null,fluid=null,w=0,h=0,last=0,accumulator=0,layoutKey='',rebuildTimer=0;
let idleSince=performance.now(),suppressClickUntil=0,ghost=null,centre=null,homeLine=null,lineLoad=0,lineKick=0;
let holdTimer=0,burstUntil=0,drip=null,nextDrip=performance.now()+tune.dripMin,gap=null,magnetOn=false,settleUntil=0,letterSize=200;
const magnet={x:0,y:0,down:true,radius:0};
const darkScheme=matchMedia('(prefers-color-scheme: dark)');
const isHome=()=>home.classList.contains('is-active');
function setHint(note){
 hintText.textContent=note||(motion.active?'Antippen öffnet. Ziehen, Neigen oder Schütteln bewegt. Halten lässt platzen.':'Antippen öffnet. Ziehen bewegt. Halten lässt platzen.');
 scheduleGrid();
}
// Paper and ink follow the stylesheet, including its dark scheme.
function cssColor(name){
 const value=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 const m=value.match(/^#([0-9a-f]{6})$/i);
 return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)/255):null;
}
const colors=()=>({paper:cssColor('--paper')||[1,1,1],ink:cssColor('--ink')||[0,0,0]});

// ---------------------------------------------------------------- liquid ---
function createRenderer(){
 try{renderer=new FluidRenderer(canvas,colors());w=h=0;home.classList.remove('no-liquid');}
 catch(error){console.warn('Liquid Type:',error);renderer=null;home.classList.add('no-liquid');}
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
 gap=layout.length>1?{left:layout[0].x+layout[0].width-size*.2,right:layout[1].x+size*.2,top:layout[0].y,bottom:layout[0].y+layout[0].height}:null;
 letterSize=size;
 ghost=null;draw();
}
function fitCanvas(){
 const box=canvas.getBoundingClientRect(),nw=Math.round(box.width),nh=Math.round(box.height);
 if(nw<2||nh<2)return false;
 if(nw!==w||nh!==h){w=nw;h=nh;renderer.resize(w,h);}
 return true;
}
const sampleInitials=layout=>sampleGlyphs(w,h,g=>paint(g,layout),w<700?2200:4200);
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
 idleSince=performance.now();settleUntil=idleSince+tune.assembleMs;
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
 else if(t>nextDrip){if(!reducedMotion.matches&&!pointer.down&&!burstUntil&&!intro.open&&calm())startDrip(t);else nextDrip=t+800;}
}
function scheduleRebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>rebuild(),120);}
function draw(){if(renderer&&fluid){renderer.dropShrink=tune.dropShrink;renderer.draw(fluid);}}
function local(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function disturb(x,y,dx,dy,radius){if(fluid&&Math.abs(dx)+Math.abs(dy)>=.1)fluid.impulse(x,y,dx,dy,radius);}

home.addEventListener('pointerdown',e=>{
 if(!fluid||transition||pointer.id!==null||e.button>0||e.target.closest('a, .link, .line-hit'))return;
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
 magnetOn=!pointer.down&&e.pointerType==='mouse'&&!!gap&&p.x>gap.left&&p.x<gap.right&&p.y>gap.top&&p.y<gap.bottom;
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
 const dt=last?Math.min(.04,(t-last)/1000):0;last=t;
 // The home line runs on the same clock as the liquid, so both can push each other.
 if(isHome()){homeLine?.step(dt,Math.min(LINE_LOAD_MAX,lineLoad)*tune.lineLoadGain,lineKick);lineKick=0;}
 if(!fluid||!renderer)return;
 settleMotion(t);
 accumulator=Math.min(.04,accumulator+dt);
 if(transition){
  // In flight between initials and heading: plain, thicker physics so the
  // liquid is calm when the real heading takes over; nothing else.
  const flight={...parameters,viscosity:tune.morphViscosity,homing:tune.morphHoming};
  while(accumulator>=1/120){fluid.step(1/120,flight,null);accumulator-=1/120;}
  blendSizes(t);draw();return;
 }
 idleMotion(t);effects(t);
 if(accumulator>=1/120){
  const box=canvas.getBoundingClientRect(),shape=homeLine?.shape();
  const line=shape&&{top:shape.top-box.top,width:shape.width,anchor:shape.anchor,offset:shape.offset,rate:shape.rate,shift:box.left};
  magnet.radius=letterSize*tune.magnetRadius;
  const brush=pointer.down?pointer:magnetOn&&!reducedMotion.matches?magnet:null;
  const prm=brush===magnet?{...parameters,strength:tune.magnetStrength}:t<settleUntil?{...parameters,viscosity:.3,attraction:.5,homing:2}:parameters;
  while(accumulator>=1/120){
   fluid.step(1/120,prm,brush);
   if(line){const hit=restrain(fluid,line);lineLoad=hit.load;lineKick+=Math.min(LINE_KICK_MAX,hit.impact*tune.lineImpactGain);}
   accumulator-=1/120;
  }
 }
 draw();
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;fluid=null;home.classList.add('no-liquid');});
canvas.addEventListener('webglcontextrestored',()=>{createRenderer();rebuild(true);});
darkScheme.addEventListener('change',()=>{const c=colors();renderer?.setColors(c.paper,c.ink);draw();});
new ResizeObserver(scheduleRebuild).observe(document.getElementById('views'));
new ResizeObserver(scheduleRebuild).observe(initials);
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;release({pointerId:pointer.id});resetMotion();});

// ----------------------------------------------------------------- motion ---
// Phone sensors. Only changes count: a shake or a quick tilt sends the liquid
// off; holding the phone still in any position does nothing lasting. Device
// acceleration (m/s²) becomes liquid velocity (px/s): tune.shakeGain
// integrates linear acceleration (px per metre), tune.tiltGain scales the
// change of the gravity direction per event, tune.leanGain is a faint force
// toward the tilt that relaxes within LEAN_RELAX seconds.
const LEAN_RELAX=2,NUDGE_LIMIT=260,SENSOR_TIMEOUT=300,SENSOR_WAIT=2500;
const motion={active:false,gravity:null,pose:null,last:0,events:0,waiting:0};
const debug=new URLSearchParams(location.search).has('debug')?Object.assign(document.body.appendChild(document.createElement('pre')),{className:'debug'}):null;
// With ?debug the running simulation is reachable from the console for tuning.
if(debug)window.liquidType={get fluid(){return fluid;},get drip(){return drip;},get parameters(){return parameters;},get motion(){return motion;}};
// Device frame (x right, y up in portrait) to canvas frame (x right, y down)
// as the direction the liquid moves: opposite to the device's own acceleration.
function liquidDirection(x,y){
 const angle=(screen.orientation?.angle??window.orientation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return {x:-(x*c-y*s),y:x*s+y*c};
}
const clampNudge=v=>Math.max(-NUDGE_LIMIT,Math.min(NUDGE_LIMIT,v));
function onMotion(e){
 const g=e.accelerationIncludingGravity;
 if(!g||g.x==null||g.y==null)return;
 const now=performance.now(),dt=motion.last?Math.min(.1,(now-motion.last)/1000):0;motion.last=now;motion.events++;
 if(!motion.active){motion.active=true;clearTimeout(motion.waiting);motionButton.hidden=true;setHint();}
 if(!motion.gravity){motion.gravity={x:g.x,y:g.y};motion.pose={x:g.x,y:g.y};return;}
 const before={x:motion.gravity.x,y:motion.gravity.y},fast=1-Math.exp(-dt*10),slow=1-Math.exp(-dt/LEAN_RELAX);
 motion.gravity.x+=(g.x-before.x)*fast;motion.gravity.y+=(g.y-before.y)*fast;
 motion.pose.x+=(motion.gravity.x-motion.pose.x)*slow;motion.pose.y+=(motion.gravity.y-motion.pose.y)*slow;
 const a=e.acceleration,ax=a&&a.x!=null?a.x:g.x-motion.gravity.x,ay=a&&a.y!=null?a.y:g.y-motion.gravity.y;
 const shake=liquidDirection(ax,ay),turn=liquidDirection(motion.gravity.x-before.x,motion.gravity.y-before.y),lean=liquidDirection(motion.gravity.x-motion.pose.x,motion.gravity.y-motion.pose.y);
 const dx=clampNudge(shake.x*tune.shakeGain*dt+turn.x*tune.tiltGain),dy=clampNudge(shake.y*tune.shakeGain*dt+turn.y*tune.tiltGain);
 if(fluid&&isHome()&&!document.hidden&&Math.hypot(dx,dy)>1.5){fluid.nudge(dx,dy);idleSince=now;}
 parameters.gravityX=lean.x*tune.leanGain;parameters.gravityY=lean.y*tune.leanGain;
 if(debug)debug.textContent=`sensor aktiv · ${motion.events} ereignisse\na ${ax.toFixed(2)} ${ay.toFixed(2)}  g ${g.x.toFixed(2)} ${g.y.toFixed(2)} ${(g.z??0).toFixed(2)}\nschub ${dx.toFixed(0)} ${dy.toFixed(0)} px/s  lehnen ${parameters.gravityX.toFixed(0)} ${parameters.gravityY.toFixed(0)}`;
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
function textShape(view){
 const panel=view.querySelector('.panel');if(!panel)return null;
 const styles=new Map(),words=[],walker=document.createTreeWalker(panel,NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const el=node.parentElement;if(!el||el.closest('.line'))continue;
  let style=styles.get(el);
  if(!style){const cs=getComputedStyle(el);style={font:`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,spacing:cs.letterSpacing,upper:cs.textTransform==='uppercase',px:parseFloat(cs.fontSize)||16};styles.set(el,style);}
  for(const m of node.data.matchAll(/\S+/g)){
   const range=document.createRange();range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);
   const r=range.getBoundingClientRect();
   if(r.width>0&&r.height>0)words.push({text:style.upper?m[0].toUpperCase():m[0],x:r.left+scrollX,top:r.top+scrollY,width:r.width,height:r.height,style});
  }
 }
 if(!words.length)return null;
 // Font size of the word at a page point, or of the nearest word.
 const fontAt=(x,y)=>{
  let best=null,bestD=Infinity;
  for(const w of words){
   const dx=Math.max(w.x-x,0,x-w.x-w.width),dy=Math.max(w.top-y,0,y-w.top-w.height),d=dx*dx+dy*dy;
   if(d<bestD){bestD=d;best=w;if(!d)break;}
  }
  return best.style.px;
 };
 return {fontAt,draw(g){
  g.fillStyle='black';g.textAlign='left';g.textBaseline='alphabetic';
  const metrics=new Map();
  for(const word of words){
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
const panelBudget=()=>w<700?2000:3200;
// Overlay the target view with its heading hidden, measure the heading.
function stage(view){
 view.hidden=false;view.classList.add('is-active','is-arriving');
 const shape=headingShape(view);
 if(!shape){unstage(view);return null;}
 return shape;
}
function unstage(view){view.hidden=true;view.classList.remove('is-active','is-arriving');}
// Shared tail of every morph into a non-home view: reveal, fade, hand over.
function handOver(fromView,view,focus){
 const t={finish(){
  for(const id of t.timers)clearTimeout(id);
  fromView.hidden=true;fromView.classList.remove('is-active','is-leaving');
  view.classList.remove('is-arriving','is-revealed');canvas.classList.remove('is-fading');canvasOn(false);
  transition=null;layoutKey='';scheduleGrid();
  if(focus)view.querySelector('h2')?.focus({preventScroll:true});
 }};
 startTransition(t,tune.morphMs+FADE_MS);
 t.timers.push(setTimeout(()=>{if(transition===t){view.classList.add('is-revealed');canvas.classList.add('is-fading');}},tune.morphMs));
 return t;
}
function startTransition(t,ms){t.start=performance.now();t.ms=tune.morphMs;t.timers=[];transition=t;t.timers.push(setTimeout(()=>{if(transition===t)t.finish();},ms));}
// Drop size for a particle whose word is set in a font of `px` pixels. A
// drop's visible disc is about 1.75 times its size, so at 0.65 of the
// lattice neighbouring drops still touch: small text stays a thin, joined
// line rather than dust, large text gets full drops.
const dropFor=(px,lattice)=>Math.max(lattice*.65,Math.min(tune.dropMax,px*tune.dropPerFontPx));
// Per-particle drop sizes for a flight: `from` and `to` are arrays or one
// number each; the drawn size blends between them over the flight.
function flightSizes(t,from,to){
 const n=fluid.n;t.sizeFrom=new Float32Array(n);t.sizeTo=new Float32Array(n);fluid.dropSize=new Float32Array(n);
 for(let i=0;i<n;i++){t.sizeFrom[i]=typeof from==='number'?from:from[i];t.sizeTo[i]=typeof to==='number'?to:to[i];fluid.dropSize[i]=t.sizeFrom[i];}
}
function blendSizes(now){
 const t=transition;if(!t?.sizeFrom||!fluid?.dropSize)return;
 const k=Math.min(1,(now-t.start)/t.ms),e=k*k*(3-2*k);
 for(let i=0;i<fluid.n;i++)fluid.dropSize[i]=t.sizeFrom[i]+(t.sizeTo[i]-t.sizeFrom[i])*e;
}
const sizesOf=(sample,shape)=>Float32Array.from(sample.points,p=>dropFor(shape.fontAt(p.x,p.y),sample.spacing));
// Home to a section: the initials, in whatever state they are, dissolve
// into the section's heading.
function morphForward(name,focus){
 if(!fluid?.n)return false;
 const view=views.get(name),shape=stage(view);
 if(!shape)return false;
 const old=fluid,sample=sampleGlyphs(w,h,g=>shape.draw(g),panelBudget());
 if(!sample.points.length){unstage(view);return false;}
 current=name;chrome(name);window.scrollTo(0,0);
 home.classList.add('is-leaving');release({pointerId:pointer.id});magnetOn=false;drip=null;burstUntil=0;
 renderer.setMaterial(sample.material);
 fluid=new Fluid(sample.points,w,h,sample.spacing);
 for(let i=0;i<fluid.n;i++){const j=Math.min(old.n-1,Math.floor(i*old.n/fluid.n));fluid.x[i]=old.x[j];fluid.y[i]=old.y[j];fluid.vx[i]=old.vx[j]*.3;fluid.vy[i]=old.vy[j]*.3;}
 flightSizes(handOver(home,view,focus),old.spacing,sizesOf(sample,shape));
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
 if(!fitCanvas()){unstage(view);canvasOn(false);return false;}
 const a=sampleGlyphs(w,h,g=>src.draw(g),panelBudget()),b=sampleGlyphs(w,h,g=>dst.draw(g),panelBudget());
 if(!a.points.length||!b.points.length){unstage(view);canvasOn(false);return false;}
 current=name;chrome(name);window.scrollTo(0,0);
 fromView.classList.add('is-leaving');
 renderer.setMaterial(b.material);
 fluid=new Fluid(b.points,w,h,b.spacing);
 const fromSizes=new Float32Array(fluid.n);
 for(let i=0;i<fluid.n;i++){const p=a.points[Math.floor(i*a.points.length/fluid.n)];fluid.x[i]=p.x;fluid.y[i]=p.y;fromSizes[i]=dropFor(src.fontAt(p.x,p.y),a.spacing);}
 flightSizes(handOver(fromView,view,focus),fromSizes,sizesOf(b,dst));
 draw();
 return true;
}
// Returning home: a liquid of the heading's own density starts as the
// heading and flows to the initials. The initials hold far more liquid than
// a heading, so the full set of particles only takes over on arrival.
function arriveFrom(shape){
 if(!renderer||!shape||!fitCanvas()){rebuild();scatter();return;}
 const layout=glyphLayout(),ms=sampleInitials(layout);
 const sample=sampleGlyphs(w,h,g=>shape.draw(g),panelBudget());
 if(!sample.points.length||!ms.points.length){rebuild();scatter();return;}
 fluid=new Fluid(sample.points,w,h,sample.spacing);
 for(let i=0;i<fluid.n;i++){const p=ms.points[Math.floor(i*ms.points.length/fluid.n)];fluid.tx[i]=p.x;fluid.ty[i]=p.y;}
 renderer.setMaterial(ms.material);layoutKey='';
 const t={finish(){for(const id of t.timers)clearTimeout(id);transition=null;rebuild(true);}};
 startTransition(t,tune.morphMs);
 flightSizes(t,sizesOf(sample,shape),ms.spacing);
 idleSince=performance.now();
}
function show(name,focus=true){
 if(!views.has(name))name='home';
 if(name===current)return;
 transition?.finish();gridReset();
 const from=current;
 if(canMorph()&&from&&from!=='home'&&name!=='home'&&morphBetween(from,name,focus))return;
 if(canMorph()&&from==='home'&&name!=='home'&&morphForward(name,focus))return;
 homeEntry=canMorph()&&name==='home'&&from&&from!=='home'?headingShape(views.get(from)):null;
 plainShow(name,focus);
}
function plainShow(name,focus){
 current=name;
 for(const [key,view] of views){const on=key===name;view.hidden=!on;view.classList.toggle('is-active',on);}
 chrome(name);window.scrollTo(0,0);canvasOn(name==='home');
 if(name==='home'){
  release({pointerId:pointer.id});last=0;idleSince=performance.now();resetMotion();
  const entry=homeEntry;homeEntry=null;
  requestAnimationFrame(()=>{if(entry)arriveFrom(entry);else{rebuild();scatter();}});
 }
 scheduleGrid();
 if(focus)(name==='home'?letters[0]:views.get(name).querySelector('h2'))?.focus({preventScroll:true});
}
function go(name){
 if(name===current)return;
 history.pushState(null,'',name==='home'?location.pathname+location.search:'#'+name);
 show(name);
}
document.addEventListener('click',e=>{const target=e.target.closest('[data-go]');if(target)go(target.dataset.go);});
back.addEventListener('click',()=>go(parents[current]||'home'));
window.addEventListener('popstate',()=>show(viewFromHash()));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!intro.open&&current!=='home')go(parents[current]||'home');});

// ------------------------------------------------------------------ tune ---
// Sliders for every dial above plus the physics parameters. Values live in
// this browser (localStorage) so a phone can be tuned across reloads.
const TUNE=[
 ['Physik','viscosity','Zähflüssigkeit',0,1,.01,parameters],['Physik','tension','Oberflächenspannung',0,1,.01,parameters],['Physik','attraction','Anziehung',0,1,.01,parameters],['Physik','strength','Impulsstärke',.1,2.1,.01,parameters],
 ['Zusammensetzen','assembleSpread','Streuung',.05,.6,.01],['Zusammensetzen','assembleMs','Dünnflüssig (ms)',0,4000,50],
 ['Halten und Platzen','holdMs','Haltedauer (ms)',150,1500,10],['Halten und Platzen','burstSpeed','Stärke',200,2000,10],['Halten und Platzen','burstFreeMs','Freiflug (ms)',0,800,10],
 ['Tropfen','dripMin','Pause mindestens (ms)',1000,20000,100],['Tropfen','dripMax','Pause höchstens (ms)',1000,30000,100],['Tropfen','dripFallMs','Fallzeit (ms)',200,4000,50],['Tropfen','dripSize','Größe',1,4,.1],['Tropfen','dripGravity','Schwerkraft',200,3000,10,parameters],
 ['Magnet','magnetStrength','Stärke',0,6,.1],['Magnet','magnetRadius','Radius',.1,.6,.01],
 ['Linie','lineLoadGain','Last',0,150,1],['Linie','lineImpactGain','Aufprall',0,.15,.005],
 ['Ruhebewegung','idleDelay','Verzögerung (ms)',1000,15000,100],['Ruhebewegung','idleForce','Kraft',0,4,.1],
 ['Sensoren','shakeGain','Schütteln',0,2000,10],['Sensoren','tiltGain','Kippen',0,300,1],['Sensoren','leanGain','Neigen (Schwerkraft)',0,500,5],
 ['Übergang','morphMs','Flugzeit (ms)',300,2500,50],['Übergang','morphViscosity','Zähigkeit im Flug',0,1,.01],['Übergang','morphHoming','Zug zum Ziel',1,6,.1],
 ['Textgitter','gridSpacing','Abstand',.1,.4,.01],['Textgitter','gridStiffness','Schwingung',30,600,5],['Textgitter','gridDamping','Dämpfung',.3,6,.1],['Textgitter','gridScroll','Scrollen',0,4,.1],
 ['Darstellung','dropShrink','Tropfen in Bewegung',.3,1,.01],['Darstellung','dropPerFontPx','Tropfen je Schriftpixel',.03,.15,.005],['Darstellung','dropMax','Größte Tropfen im Flug',3,8,.1],
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
  input.addEventListener('input',()=>{(target||tune)[key]=Number(input.value);show();saveTune();values.value=JSON.stringify(tuneValues());});
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
loadTune();buildTune();

// ------------------------------------------------------------- text grid ---
// Invisible horizontal strings across the whole page, one every few letter
// sizes. Every letter is its own span and rides the two strings nearest to
// it, so when a string swings the text swings with it. Crossing a string
// with the pointer grabs it; it follows until it snaps free and swings out.
// Scrolling plucks the strings in view, a tap on empty space plucks the
// nearest one. Nothing of the grid itself is drawn.
const SPLIT='.panel, .tagline, .hint';
const grid={lines:[],letters:[],spacing:70,oy:0,width:0,height:0,raf:0,then:0,timer:0,ptr:{x:NaN,y:NaN},tap:null};
const gridOn=()=>!reducedMotion.matches;
function splitText(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
 for(let node=walker.nextNode();node;node=walker.nextNode())if(node.data.trim()&&!node.parentElement.closest('.gc, .line'))nodes.push(node);
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
function gridLetters(){
 const {lines,spacing,oy}=grid;
 for(const L of grid.letters){
  const fy=(L.y-oy)/spacing,i=Math.floor(fy),k=fy-i;
  const dy=lineOffset(lines[i],L.x)*(1-k)+lineOffset(lines[i+1],L.x)*k;
  if(Math.abs(dy-L.dy)>.05){L.dy=dy;L.el.style.transform=dy?`translateY(${dy.toFixed(2)}px)`:'';}
 }
}
function gridTick(t){
 const dt=grid.then?Math.min(1/30,(t-grid.then)/1000):1/60;grid.then=t;
 let busy=false;
 for(const l of grid.lines){
  if(l.grabbed){busy=true;continue;}
  if(!l.offset&&!l.velocity)continue;
  l.velocity+=-tune.gridStiffness*l.offset*dt;l.velocity*=Math.exp(-tune.gridDamping*dt);l.offset+=l.velocity*dt;
  if(Math.abs(l.offset)<.1&&Math.abs(l.velocity)<2)l.offset=l.velocity=0;else busy=true;
 }
 gridLetters();
 if(busy)grid.raf=requestAnimationFrame(gridTick);else{grid.raf=0;grid.then=0;}
}
function gridKick(){if(!grid.raf)grid.raf=requestAnimationFrame(gridTick);}
const gridSnap=type=>type==='mouse'?grid.spacing*1.4:grid.spacing*1.1;
function gridPointer(x,y,snap){
 const px=grid.ptr.x,py=grid.ptr.y;grid.ptr.x=x;grid.ptr.y=y;
 if(px!==px)return;
 let touched=false;
 for(const l of grid.lines){
  if(!l.grabbed&&(py-l.pos)*(y-l.pos)<=0&&py!==y){l.grabbed=true;l.velocity=0;}
  if(!l.grabbed)continue;
  const pull=y-l.pos;l.at=Math.max(0,Math.min(1,x/Math.max(1,grid.width)));
  if(Math.abs(pull)>snap){gridLet(l);if(snap!==grid.spacing*1.4)try{navigator.vibrate?.(6);}catch{/* optional */}continue;}
  l.offset=pull;touched=true;
 }
 if(touched)gridKick();
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
 window.addEventListener('pointermove',e=>{if(e.target?.closest?.('.tune, .tune-toggle, dialog'))return;gridPointer(e.pageX,e.pageY,gridSnap(e.pointerType));},{passive:true});
 window.addEventListener('pointerdown',e=>{grid.tap=e.pointerType!=='mouse'&&!e.target.closest('button, a, input, .tune')?{x:e.pageX,y:e.pageY,t:performance.now()}:null;},{passive:true});
 window.addEventListener('pointerup',e=>{
  if(e.pointerType!=='mouse')gridRelease();
  // A short tap on empty space plucks the nearest string under the finger.
  const tap=grid.tap;grid.tap=null;
  if(tap&&Math.hypot(e.pageX-tap.x,e.pageY-tap.y)<10&&performance.now()-tap.t<350){
   const l=grid.lines[Math.round((e.pageY-grid.oy)/grid.spacing)];
   if(l){let pull=e.pageY-l.pos;if(Math.abs(pull)<grid.spacing*.25)pull=grid.spacing*.5*(pull<0?-1:1);gridFlick(l,e.pageX,pull*2.4);}
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
  const cap=grid.spacing*1.2,top=scrollY-grid.spacing,bottom=scrollY+innerHeight+grid.spacing;
  for(const l of grid.lines){
   if(l.pos<top||l.pos>bottom)continue;
   const vary=.75+.25*Math.sin(l.pos*.05);
   gridFlick(l,grid.width*(.5+.3*Math.sin(l.pos*.013)),Math.max(-cap,Math.min(cap,v*tune.gridScroll))*vary);
  }
 },{passive:true});
 window.addEventListener('resize',scheduleGrid,{passive:true});
 document.fonts?.ready.then(scheduleGrid);
 scheduleGrid();
}

// ----------------------------------------------------------------- intro ---
function closeIntro(){if(intro.open)intro.close();}
intro.addEventListener('close',()=>{try{sessionStorage.setItem('ms-intro-seen','1');}catch{/* storage unavailable */}});
intro.addEventListener('click',e=>{if(e.target===intro)closeIntro();});

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
 return {step,shape(){return {top:host.getBoundingClientRect().top,width,anchor,offset:clamped(),rate};}};
}
document.querySelectorAll('.panel h2').forEach(h2=>{const line=document.createElement('div');h2.after(line);pluckable(line);});
homeLine=pluckable(document.querySelector('[data-line]'),true);

// ----------------------------------------------------------------- start ---
show(viewFromHash(),false);
let introSeen=false;try{introSeen=sessionStorage.getItem('ms-intro-seen')==='1';}catch{/* storage unavailable */}
if(!introSeen&&current==='home'&&typeof intro.showModal==='function'){intro.showModal();setTimeout(closeIntro,12000);}
createRenderer();
try{await document.fonts?.load('700 100px "Playfair Display"');}catch{/* fallback serif */}
rebuild(true);
if(intro.open)intro.addEventListener('close',scatter,{once:true});else scatter();
document.fonts?.ready.then(()=>rebuild());
requestAnimationFrame(frame);
