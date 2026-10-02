// Matthias Sütterlin study: the initials M and S run on the Liquid Type engine.
import {Fluid} from '../physics.mjs';
import {FluidRenderer} from '../render.mjs';
import {sampleGlyphs} from '../glyphs.mjs';
import {restrain} from './coupling.mjs';

const $=id=>document.getElementById(id);
const home=$('home'),canvas=$('liquid'),initials=$('initials'),intro=$('intro'),back=$('back'),crumb=$('crumb'),hintText=$('hintText'),motionButton=$('motionButton');
const letters=[...initials.querySelectorAll('.initial')];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const parameters={viscosity:.35,tension:.65,attraction:.5,strength:1.3,gravityX:0,gravityY:0,dripGravity:1400};
const pointer={x:0,y:0,down:false,radius:80,id:null,last:0,startX:0,startY:0,dragged:false};
const IDLE_DELAY=5000,IDLE_FORCE=1.6;
// Letters condense from a cloud this wide (share of the shorter canvas side).
const ASSEMBLE_SPREAD=.38;
// Holding a letter gathers the liquid, then it bursts; the spring lets go briefly.
const HOLD_MS=480,BURST_SPEED=1100,BURST_FREE_MS=260;
// Drops detach from the lowest edge every few quiet seconds and fall onto the line.
const DRIP_MIN=5000,DRIP_MAX=9000,DRIP_FALL_MS=1300,DRIP_SIZE=2.3,CALM_SPEED=25;
// A hovering mouse between M and S draws the liquid of both toward it.
const MAGNET_STRENGTH=2.2,MAGNET_RADIUS=.26;
// The home line presses on the liquid and the liquid weighs on the line.
const LINE_LOAD_GAIN=40,LINE_LOAD_MAX=600,LINE_IMPACT_GAIN=.05,LINE_KICK_MAX=400;
let renderer=null,fluid=null,w=0,h=0,last=0,accumulator=0,layoutKey='',rebuildTimer=0;
let idleSince=performance.now(),suppressClickUntil=0,ghost=null,centre=null,homeLine=null,lineLoad=0,lineKick=0;
let holdTimer=0,burstUntil=0,drip=null,nextDrip=performance.now()+DRIP_MIN,gap=null,magnetOn=false;
const magnet={x:0,y:0,down:true,radius:0};
const darkScheme=matchMedia('(prefers-color-scheme: dark)');
const isHome=()=>home.classList.contains('is-active');
function setHint(note){
 hintText.textContent=note||(motion.active?'Antippen öffnet. Ziehen, Neigen oder Schütteln bewegt. Halten lässt platzen.':'Antippen öffnet. Ziehen bewegt. Halten lässt platzen.');
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
 const box=home.getBoundingClientRect();
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
 magnet.radius=size*MAGNET_RADIUS;
 ghost=null;draw();
}
function fitCanvas(){
 const box=home.getBoundingClientRect(),nw=Math.round(box.width),nh=Math.round(box.height);
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
 const r=Math.min(w,h)*ASSEMBLE_SPREAD;
 for(let i=0;i<fluid.n;i++){
  const a=Math.random()*Math.PI*2,d=r*Math.sqrt(Math.random());
  fluid.x[i]=clampX(fluid.tx[i]+Math.cos(a)*d);fluid.y[i]=clampY(fluid.ty[i]+Math.sin(a)*d);fluid.vx[i]=fluid.vy[i]=0;
 }
 idleSince=performance.now();
}
// Everything flies away from the press point; the spring lets go for a moment.
function burst(x,y){
 if(!fluid)return;
 const R=Math.max(w,h),now=performance.now();
 for(let i=0;i<fluid.n;i++){
  const dx=fluid.x[i]-x,dy=fluid.y[i]-y,d=Math.hypot(dx,dy)||1,f=1-d/R;
  if(f<=0)continue;
  const speed=BURST_SPEED*Math.sqrt(f)*(.8+.4*Math.random());
  fluid.vx[i]=Math.max(-1500,Math.min(1500,fluid.vx[i]+dx/d*speed));fluid.vy[i]=Math.max(-1500,Math.min(1500,fluid.vy[i]+dy/d*speed));
 }
 if(!reducedMotion.matches){fluid.free.fill(1);burstUntil=now+BURST_FREE_MS;drip=null;}
 pointer.down=false;pointer.dragged=true;suppressClickUntil=now+600;idleSince=now;
 try{navigator.vibrate?.(20);}catch{/* optional */}
}
function calm(){let sum=0,count=0;for(let i=0;i<fluid.n;i+=37){sum+=Math.hypot(fluid.vx[i],fluid.vy[i]);count++;}return count===0||sum/count<CALM_SPEED;}
function startDrip(t){
 let lowest=0;for(let i=0;i<fluid.n;i++)if(fluid.ty[i]>lowest)lowest=fluid.ty[i];
 const bottom=[];for(let i=0;i<fluid.n;i++)if(fluid.ty[i]>=lowest-fluid.spacing*2.5)bottom.push(i);
 if(!bottom.length)return;
 const seed=bottom[Math.floor(Math.random()*bottom.length)],sx=fluid.tx[seed],sy=fluid.ty[seed],r=fluid.spacing*DRIP_SIZE;
 const indices=[];for(let i=0;i<fluid.n;i++)if(Math.hypot(fluid.tx[i]-sx,fluid.ty[i]-sy)<r){indices.push(i);fluid.free[i]=1;}
 drip={indices,until:t+DRIP_FALL_MS};
}
function effects(t){
 if(burstUntil&&t>burstUntil){fluid.free.fill(0);burstUntil=0;}
 if(drip){if(t>drip.until){for(const i of drip.indices)fluid.free[i]=0;drip=null;nextDrip=t+DRIP_MIN+Math.random()*(DRIP_MAX-DRIP_MIN);}}
 else if(t>nextDrip){if(!reducedMotion.matches&&!pointer.down&&!burstUntil&&!intro.open&&calm())startDrip(t);else nextDrip=t+800;}
}
function scheduleRebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>rebuild(),120);}
function draw(){if(renderer&&fluid)renderer.draw(fluid,dropSpacingNow(performance.now()));}
function local(e){const r=home.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function disturb(x,y,dx,dy,radius){if(fluid&&Math.abs(dx)+Math.abs(dy)>=.1)fluid.impulse(x,y,dx,dy,radius);}

home.addEventListener('pointerdown',e=>{
 if(!fluid||transition||pointer.id!==null||e.button>0||e.target.closest('a, .link, .line-hit'))return;
 const p=local(e);
 Object.assign(pointer,{x:p.x,y:p.y,startX:e.clientX,startY:e.clientY,down:true,id:e.pointerId,last:performance.now(),dragged:false});
 idleSince=performance.now();magnetOn=false;
 clearTimeout(holdTimer);holdTimer=setTimeout(()=>{if(pointer.down&&!pointer.dragged)burst(pointer.x,pointer.y);},HOLD_MS);
});
home.addEventListener('contextmenu',e=>{if(e.target.closest('.initial, .liquid'))e.preventDefault();});
window.addEventListener('pointermove',e=>{
 if(!fluid||!isHome()||transition||(pointer.id!==null&&e.pointerId!==pointer.id))return;
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
 if(reducedMotion.matches||pointer.down||!centre||t-idleSince<IDLE_DELAY){ghost=null;return;}
 const s=(t-idleSince-IDLE_DELAY)/1000;
 const x=centre.x+Math.cos(s*.45)*centre.rx,y=centre.y+Math.sin(s*.7)*centre.ry;
 if(ghost)disturb(x,y,(x-ghost.x)*IDLE_FORCE*parameters.strength,(y-ghost.y)*IDLE_FORCE*parameters.strength,pointer.radius*.6);
 ghost={x,y};
}
function frame(t){
 requestAnimationFrame(frame);
 if(document.hidden||!isHome()){last=0;return;}
 const dt=last?Math.min(.04,(t-last)/1000):0;last=t;
 // The home line runs on the same clock as the liquid, so both can push each other.
 homeLine?.step(dt,Math.min(LINE_LOAD_MAX,lineLoad)*LINE_LOAD_GAIN,lineKick);lineKick=0;
 if(!fluid||!renderer)return;
 settleMotion(t);
 accumulator=Math.min(.04,accumulator+dt);
 if(transition){
  // In flight between initials and heading: plain, thicker physics so the
  // liquid is calm when the real heading takes over; nothing else.
  const flight={...parameters,viscosity:Math.max(parameters.viscosity,MORPH_VISCOSITY)};
  while(accumulator>=1/120){fluid.step(1/120,flight,null);accumulator-=1/120;}
  draw();return;
 }
 idleMotion(t);effects(t);
 if(accumulator>=1/120){
  const box=home.getBoundingClientRect(),shape=homeLine?.shape();
  const line=shape&&{top:shape.top-box.top,width:shape.width,anchor:shape.anchor,offset:shape.offset,rate:shape.rate,shift:box.left};
  const brush=pointer.down?pointer:magnetOn&&!reducedMotion.matches?magnet:null;
  const prm=brush===magnet?{...parameters,strength:MAGNET_STRENGTH}:parameters;
  while(accumulator>=1/120){
   fluid.step(1/120,prm,brush);
   if(line){const hit=restrain(fluid,line);lineLoad=hit.load;lineKick+=Math.min(LINE_KICK_MAX,hit.impact*LINE_IMPACT_GAIN);}
   accumulator-=1/120;
  }
 }
 draw();
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;fluid=null;home.classList.add('no-liquid');});
canvas.addEventListener('webglcontextrestored',()=>{createRenderer();rebuild(true);});
darkScheme.addEventListener('change',()=>{const c=colors();renderer?.setColors(c.paper,c.ink);draw();});
new ResizeObserver(scheduleRebuild).observe(home);
new ResizeObserver(scheduleRebuild).observe(initials);
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;release({pointerId:pointer.id});resetMotion();});

// ----------------------------------------------------------------- motion ---
// Phone sensors. Only changes count: a shake or a quick tilt sends the liquid
// off; holding the phone still in any position does nothing lasting. Device
// acceleration (m/s²) becomes liquid velocity (px/s): SHAKE_GAIN integrates
// linear acceleration (px per metre), TILT_GAIN scales the change of the
// gravity direction per event, LEAN_GAIN is a faint force toward the tilt
// that relaxes within LEAN_RELAX seconds.
const SHAKE_GAIN=650,TILT_GAIN=90,LEAN_GAIN=120,LEAN_RELAX=2,NUDGE_LIMIT=260,SENSOR_TIMEOUT=300,SENSOR_WAIT=2500;
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
 const dx=clampNudge(shake.x*SHAKE_GAIN*dt+turn.x*TILT_GAIN),dy=clampNudge(shake.y*SHAKE_GAIN*dt+turn.y*TILT_GAIN);
 if(fluid&&isHome()&&!document.hidden&&Math.hypot(dx,dy)>1.5){fluid.nudge(dx,dy);idleSince=now;}
 parameters.gravityX=lean.x*LEAN_GAIN;parameters.gravityY=lean.y*LEAN_GAIN;
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
// Opening a section, the initials flow into its heading (MORPH_MS), then the
// real heading and text take over (FADE_MS). Coming back, the heading flows
// into the initials.
const MORPH_MS=1000,FADE_MS=350,MORPH_VISCOSITY=.85;
let current=null,transition=null,homeEntry=null;
function viewFromHash(){const name=decodeURIComponent(location.hash.slice(1));return views.has(name)?name:'home';}
function chrome(name){
 const label=views.get(name).getAttribute('aria-label');
 back.hidden=name==='home';crumb.textContent=label;
 document.title=name==='home'?baseTitle:`${label} — Matthias Sütterlin`;
}
const canMorph=()=>!!renderer&&!!fluid?.n&&!reducedMotion.matches&&!home.classList.contains('no-liquid');
// A displayed view's single-line heading as a drawing in page coordinates,
// which equal the home canvas coordinates; null when wrapped or not laid out.
function headingShape(view){
 const h2=view.querySelector('h2');if(!h2)return null;
 const r=h2.getBoundingClientRect(),cs=getComputedStyle(h2),size=parseFloat(cs.fontSize);
 if(r.width<2||r.height>size*1.4)return null;
 const text=h2.textContent.trim(),font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,spacing=cs.letterSpacing;
 const x=r.left+scrollX,top=r.top+scrollY,height=r.height;
 return {draw(g){
  g.font=font;if('letterSpacing' in g)g.letterSpacing=spacing;g.fillStyle='black';g.textAlign='left';g.textBaseline='alphabetic';
  const m=g.measureText('M'),asc=m.fontBoundingBoxAscent,desc=m.fontBoundingBoxDescent;
  const baseline=Number.isFinite(asc)&&Number.isFinite(desc)?top+(height-asc-desc)/2+asc:top+height*.78;
  g.fillText(text,x,baseline);
 }};
}
function startTransition(t,ms){t.start=performance.now();t.timers=[];transition=t;t.timers.push(setTimeout(()=>{if(transition===t)t.finish();},ms));}
function dropSpacingNow(t){
 if(!transition||!fluid)return fluid?.spacing;
 const k=Math.min(1,(t-transition.start)/MORPH_MS),e=k*k*(3-2*k);
 return transition.dropFrom+(transition.dropTo-transition.dropFrom)*e;
}
function morphForward(name,focus){
 const view=views.get(name);
 view.hidden=false;view.classList.add('is-active','is-arriving');
 const shape=headingShape(view);
 if(!shape){view.hidden=true;view.classList.remove('is-active','is-arriving');return false;}
 current=name;chrome(name);window.scrollTo(0,0);
 home.classList.add('is-leaving');release({pointerId:pointer.id});magnetOn=false;drip=null;burstUntil=0;
 const old=fluid,sample=sampleGlyphs(w,h,g=>shape.draw(g),Math.max(1200,old.n));
 if(!sample.points.length){view.hidden=true;view.classList.remove('is-active','is-arriving');home.classList.remove('is-leaving');return false;}
 renderer.setMaterial(sample.material);
 fluid=new Fluid(sample.points,w,h,sample.spacing);
 for(let i=0;i<fluid.n;i++){const j=Math.min(old.n-1,Math.floor(i*old.n/fluid.n));fluid.x[i]=old.x[j];fluid.y[i]=old.y[j];fluid.vx[i]=old.vx[j]*.3;fluid.vy[i]=old.vy[j]*.3;}
 const t={dropFrom:old.spacing,dropTo:fluid.spacing,finish(){
  for(const id of t.timers)clearTimeout(id);
  home.hidden=true;home.classList.remove('is-active','is-leaving');
  view.classList.remove('is-arriving','is-revealed');canvas.classList.remove('is-fading');
  transition=null;layoutKey='';
  if(focus)view.querySelector('h2')?.focus({preventScroll:true});
 }};
 startTransition(t,MORPH_MS+FADE_MS);
 t.timers.push(setTimeout(()=>{if(transition===t){view.classList.add('is-revealed');canvas.classList.add('is-fading');}},MORPH_MS));
 return true;
}
// Returning home: a liquid of the heading's own density starts as the
// heading and flows to the initials. The initials hold far more liquid than
// a heading, so the full set of particles only takes over on arrival.
function arriveFrom(shape){
 if(!renderer||!shape||!fitCanvas()){rebuild();scatter();return;}
 const layout=glyphLayout(),ms=sampleInitials(layout);
 const sample=sampleGlyphs(w,h,g=>shape.draw(g),Math.max(1200,ms.points.length));
 if(!sample.points.length||!ms.points.length){rebuild();scatter();return;}
 fluid=new Fluid(sample.points,w,h,sample.spacing);
 for(let i=0;i<fluid.n;i++){const p=ms.points[Math.floor(i*ms.points.length/fluid.n)];fluid.tx[i]=p.x;fluid.ty[i]=p.y;}
 renderer.setMaterial(ms.material);layoutKey='';
 const t={dropFrom:sample.spacing,dropTo:ms.spacing,finish(){for(const id of t.timers)clearTimeout(id);transition=null;rebuild(true);}};
 startTransition(t,MORPH_MS);
 idleSince=performance.now();
}
function show(name,focus=true){
 if(!views.has(name))name='home';
 if(name===current)return;
 transition?.finish();
 const from=current;
 if(canMorph()&&from==='home'&&name!=='home'&&morphForward(name,focus))return;
 homeEntry=canMorph()&&name==='home'&&from&&from!=='home'?headingShape(views.get(from)):null;
 plainShow(name,focus);
}
function plainShow(name,focus){
 current=name;
 for(const [key,view] of views){const on=key===name;view.hidden=!on;view.classList.toggle('is-active',on);}
 chrome(name);window.scrollTo(0,0);
 if(name==='home'){
  release({pointerId:pointer.id});last=0;idleSince=performance.now();resetMotion();
  const entry=homeEntry;homeEntry=null;
  requestAnimationFrame(()=>{if(entry)arriveFrom(entry);else{rebuild();scatter();}});
 }
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
