import {Fluid} from './physics.mjs?v=bbd22bbf';
import {FluidRenderer} from './render.mjs?v=bbd22bbf';
import {sampleGlyphs} from './glyphs.mjs?v=bbd22bbf';
import {createQuality} from './quality.mjs?v=bbd22bbf';
import {MotionReader} from './sensors.mjs?v=bbd22bbf';
import {LiquidCursor} from './cursor.mjs?v=bbd22bbf';
import {scatterAround,burstFrom,isCalm,meanSpeed,dripIndices,Settle,idleHand} from './effects.mjs?v=bbd22bbf';
const $=id=>document.getElementById(id);
const canvas=$('fluid'),wrap=$('canvasWrap'),input=$('textInput'),cursor=$('cursor');
// No alternate text layer: the only visible typography is the particle surface.
function disturb(x,y,dx,dy,radius){
 if(Math.abs(dx)+Math.abs(dy)<.1)return;
 fluid.impulse(x,y,dx,dy,radius);
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const controls=['viscosity','tension','attraction','strength'];
const parameters={viscosity:.35,tension:.65,attraction:.5,strength:1.3,gravityX:0,gravityY:0,dripGravity:1400};
let renderer=null,fluid=null,paused=reduced.matches,failed=false,w=0,h=0,last=0,accumulator=0,textTimer,resizeTimer,quality=null;
const pointer={x:-1000,y:-1000,down:false,radius:95,id:null,type:'',last:0,startX:0,startY:0,dragged:false,burst:false,cx:0,cy:0,since:0};
// The effects of the MS page, each switchable in the controls. Their dials
// are the MS page's tuned values (see `defaults` in src/MS/ms.mjs): idle hand,
// letters condensing from a cloud, hold to burst, drips from the lowest
// edge, the magnet, phone motion and the pointer's liquid drop.
const FX={idleDelay:4000,idleForce:1.4,assembleSpread:.22,assembleMs:2200,holdMs:450,burstSpeed:1200,burstFreeMs:300,
 dripMin:6000,dripMax:11000,dripFallMs:1300,dripSize:2.3,magnetStrength:2.2,magnetRadius:.26,shakeGain:650,tiltGain:90,leanGain:120,cursorSize:.08,
 // Scroll waves and phone pushes act in proportion to the text: full at
 // this letter size (px) and above, weaker for smaller text, so small text on
 // a phone sloshes as much, relatively, as large text on a desktop.
 impulseSize:240};
const effects={cursor:true,magnet:true,burst:true,drips:true,idle:true,assemble:true,motion:false},EFFECTS=Object.keys(effects);
const settle=new Settle(),magnet={x:0,y:0,down:true,radius:0};
let letterSize=200,strokeRatio=8,restCalm=0,centre=null,liquidArea=null,magnetOn=false,idleSince=performance.now(),ghost=null,holdTimer=0,burstUntil=0,drip=null,nextDrip=performance.now()+FX.dripMin,assembled=false;
function updateStatus(){
 $('pause').setAttribute('aria-pressed',String(paused));$('pauseLabel').textContent=paused?'Fortsetzen':'Pause';$('pauseIcon').textContent=paused?'▶':'Ⅱ';
 $('status').textContent=failed?'GRAFIK PAUSIERT':paused?'PHYSICS PAUSED':'LIVE PHYSICS';$('statusDot').classList.toggle('paused',paused||failed);
}
function setPaused(value){paused=value;accumulator=0;last=0;pointer.down=false;cursor.classList.remove('dragging');updateStatus();}
function setParameter(name,value){
 const v=Math.min(100,Math.max(0,Number(value)));$(name).value=String(v);$(name+'Value').value=v+'%';$(name).style.setProperty('--fill',v+'%');parameters[name]=name==='strength'?.1+v/50:v/100;
}
controls.forEach(name=>{$(name).addEventListener('input',e=>setParameter(name,e.target.value));setParameter(name,$(name).value);});
function maskPoints(text,width,height){
 if(!text.trim()){const blank=document.createElement('canvas');blank.width=blank.height=1;renderer?.setMaterial(blank);return{points:[],spacing:5,size:letterSize,stroke:0};}
 const ctx=document.createElement('canvas').getContext('2d');
 let size=Math.min(height*.63,width*.7,330);ctx.font=`500 ${size}px Georgia, 'Times New Roman', serif`;
 const measured=ctx.measureText(text).width;size*=Math.min(1,width*.86/Math.max(1,measured));ctx.font=`500 ${size}px Georgia, 'Times New Roman', serif`;
 const m=ctx.measureText(text),font=ctx.font,baseline=height/2+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2;
 const sample=sampleGlyphs(width,height,g=>{g.font=font;g.textAlign='center';g.fillStyle='black';g.fillText(text,width/2,baseline);},Math.round((width<700?2200:4200)*(quality?.particles??1)));
 renderer?.setMaterial(sample.material);
 return {points:sample.points,spacing:sample.spacing,size,stroke:sample.stroke};
}
function setText(value,animate=true){
 input.value=Array.from(value).slice(0,32).join('');const text=input.value;
 $('charCount').textContent=Array.from(text).length+' / 32';$('fallbackText').textContent=text;
 $('emptyNote').hidden=!!text.trim();canvas.setAttribute('aria-label',`Flüssige Schrift ${text||'– leer'}. Mit Maus oder Finger ziehen. Mit Pfeiltasten Wellen erzeugen.`);
 if(!w||!h)return;
 const old=fluid;const {points,spacing,size,stroke}=maskPoints(text,w,h);fluid=new Fluid(points,w,h,spacing);
 measureText(points,size);strokeRatio=stroke?stroke/spacing:8;drip=null;burstUntil=0;idleSince=performance.now();
 // Keep a short, bounded morph when typing. Particle count may change independently.
 if(animate&&old?.n&&!paused){
  for(let i=0;i<fluid.n;i++){
   const j=Math.min(old.n-1,Math.floor(i*old.n/fluid.n));
   fluid.x[i]=fluid.tx[i]+Math.max(-80,Math.min(80,old.x[j]-fluid.tx[i]))*.55;
   fluid.y[i]=fluid.ty[i]+Math.max(-60,Math.min(60,old.y[j]-fluid.ty[i]))*.55;
   fluid.vy[i]=Math.sin(i*.19)*30;
  }
 }
 $('particleCount').textContent=fluid.n.toLocaleString('de-DE')+' PARTICLES';
 draw();
}
// Share of the full scroll wave and phone push for the current text size.
function textScale(){return Math.max(.15,Math.min(1,letterSize/FX.impulseSize));}
// Where the text is: its size for the drop and the magnet, its centre for
// the idle hand, and the area over which the magnet works (the ink, widened
// by half the magnet's reach).
function measureText(points,size){
 letterSize=size;
 if(!points.length){centre=liquidArea=null;return;}
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const p of points){if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y;}
 centre={x:(x0+x1)/2,y:(y0+y1)/2,rx:(x1-x0)*.42,ry:size*.3};
 const reach=size*FX.magnetRadius*.5;liquidArea={left:x0-reach,right:x1+reach,top:y0-reach,bottom:y1+reach};
}
function draw(){
 if(!renderer||!fluid||failed)return;
 // The pointer's drop melting into the letters is drawn with the liquid.
 renderer.extra=effects.cursor?liquidCursor.solid:null;
 // Moving liquid draws a free surface that reaches beyond the drops, which
 // swells thin strokes (few drops across) the most. Their reach shrinks a
 // little, to 0.85 at two drops per stroke: less would tear moving text into
 // dust, and lone drops stay visible.
 const grow=.85+.15*Math.max(0,Math.min(1,(strokeRatio-2)/4));
 renderer.fine=grow<1?{from:1e4,to:1e4+1,grow,amp:1}:{from:0,to:0,grow:1,amp:1};
 renderer.calm=restCalm;
 renderer.draw(fluid);
}
function showFailure(message){failed=true;canvas.style.visibility='hidden';$('fallback').hidden=false;$('fallbackMessage').textContent=message;cursor.style.display='none';updateStatus();}
function setup(){
 try{
  renderer=new FluidRenderer(canvas);failed=false;canvas.style.visibility='visible';$('fallback').hidden=true;
  quality??=createQuality(renderer.gl,{floatSurface:renderer.floatSurface,onChange:applyQuality});renderer.maxScale=quality.resolution;
  resize();updateStatus();
  if(!assembled){assembled=true;assemble();}
 }catch(error){console.warn('Liquid Type graphics:',error);showFailure('Die interaktive Grafik ist gerade nicht verfügbar. Bitte versuche es mit aktivierter Hardwarebeschleunigung in einem aktuellen Browser.');}
}
// A slow device turned a quality dial down: draw fewer pixels, or rebuild
// the text from fewer particles.
function applyQuality({changed}){
 if(!renderer||failed||!w||!h)return;
 if(changed==='resolution'){renderer.maxScale=quality.resolution;renderer.resize(w,h);draw();}
 else setText(input.value);
}
function resize(){
 const rect=wrap.getBoundingClientRect();const nw=Math.max(100,Math.round(rect.width)),nh=Math.max(160,Math.round(rect.height));
 if(nw===w&&nh===h&&fluid&&renderer?.w===w)return;w=nw;h=nh;pointer.radius=Math.max(60,Math.min(110,w*.13));quality?.reset();
 if(renderer&&!failed)renderer.resize(w,h);setText(input.value,false);
}
input.addEventListener('input',()=>{clearTimeout(textTimer);$('charCount').textContent=Array.from(input.value).length+' / 32';textTimer=setTimeout(()=>setText(input.value),130);});
input.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(textTimer);setText(input.value);input.blur();}});
$('pause').addEventListener('click',()=>setPaused(!paused));
// With the effect on, resetting lets the letters condense anew.
$('reset').addEventListener('click',()=>{fluid?.reset();pointer.down=false;drip=null;burstUntil=0;if(!assemble())draw();});
$('recover').addEventListener('click',()=>location.reload());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showFailure('Die Grafikverbindung wurde unterbrochen. Sie wird automatisch wiederhergestellt, sobald dein Browser bereit ist.');});
canvas.addEventListener('webglcontextrestored',()=>{w=0;h=0;setup();});
function move(e){
 const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const now=performance.now();
 if(fluid&&!paused&&!failed&&pointer.last){
  const dx=x-pointer.x,dy=y-pointer.y;
  if(pointer.down)disturb(x,y,dx*16*parameters.strength,dy*16*parameters.strength,pointer.radius);
  else if(e.pointerType==='mouse'&&Math.hypot(dx,dy)<100)disturb(x,y,dx*2.5*parameters.strength,dy*2.5*parameters.strength,pointer.radius*.65);
 }
 // A press that moves is a drag, not a hold; after a burst, moving drags again.
 if(pointer.id!==null){pointer.cx=e.clientX;pointer.cy=e.clientY;}
 if(pointer.burst&&pointer.id!==null&&!pointer.down&&!paused&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>8)pressAgain(true);
 if(pointer.down&&!pointer.dragged&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>8){pointer.dragged=true;clearTimeout(holdTimer);}
 magnetOn=effects.magnet&&!pointer.down&&e.pointerType==='mouse'&&!!liquidArea&&x>liquidArea.left&&x<liquidArea.right&&y>liquidArea.top&&y<liquidArea.bottom;
 magnet.x=x;magnet.y=y;
 pointer.x=x;pointer.y=y;pointer.last=now;idleSince=now;cursor.style.left=x+'px';cursor.style.top=y+'px';
 // The liquid drop replaces the drawn ring while it is on.
 if(e.pointerType==='mouse'&&!failed)cursor.style.display=effects.cursor&&liquidCursor.ready?'none':'grid';
}
canvas.addEventListener('pointerdown',e=>{
 if(pointer.id!==null||failed)return;
 move(e);Object.assign(pointer,{id:e.pointerId,type:e.pointerType,cx:e.clientX,cy:e.clientY,burst:false});magnetOn=false;
 canvas.setPointerCapture(e.pointerId);
 if(paused){pointer.down=false;pointer.dragged=false;}else pressAgain(false);
});
// A press holds the liquid under the pointer; held still, it bursts. After a
// burst the finger may stay down: moving it drags the liquid again at once
// (`dragging`), and holding still until the letters are back starts a fresh
// press, so holding on bursts them again.
function pressAgain(dragging){
 Object.assign(pointer,{down:true,dragged:dragging,startX:pointer.cx,startY:pointer.cy,since:performance.now()});cursor.classList.add('dragging');
 clearTimeout(holdTimer);
 if(!dragging&&effects.burst)holdTimer=setTimeout(()=>{if(pointer.down&&!pointer.dragged)burstAt(pointer.x,pointer.y);},FX.holdMs);
}
// Phones have a long press of their own (about 400 ms on Android): a context
// menu, or the browser taking the touch over with pointercancel. It may come
// before holdMs and would swallow the hold, so a finger held still for most
// of holdMs bursts right then.
function longPress(){
 if(!effects.burst||!pointer.down||pointer.dragged||pointer.type==='mouse'||performance.now()-pointer.since<FX.holdMs*.6)return;
 clearTimeout(holdTimer);burstAt(pointer.x,pointer.y);
}
canvas.addEventListener('contextmenu',e=>{if(pointer.id!==null&&pointer.type!=='mouse'){e.preventDefault();longPress();}});
canvas.addEventListener('pointermove',e=>{if(pointer.id!==null&&e.pointerId!==pointer.id)return;move(e);});
function release(e){if(pointer.id!==null&&e.pointerId!==pointer.id)return;clearTimeout(holdTimer);pointer.down=false;pointer.id=null;pointer.dragged=false;pointer.burst=false;cursor.classList.remove('dragging');}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',e=>{if(e.pointerId===pointer.id)longPress();release(e);});canvas.addEventListener('lostpointercapture',release);
canvas.addEventListener('pointerleave',()=>{cursor.style.display='none';magnetOn=false;if(!pointer.down)pointer.last=0;});
canvas.addEventListener('keydown',e=>{
 if(e.key===' '){e.preventDefault();setPaused(!paused);return;}
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
  e.preventDefault();idleSince=performance.now();if(fluid&&!paused){const dx=e.key==='ArrowLeft'?-420:e.key==='ArrowRight'?420:0,dy=e.key==='ArrowUp'?-420:e.key==='ArrowDown'?420:0;fluid.impulse(w/2,h/2,dx,dy,Math.max(w,h));}
 }
});
let previousScroll=scrollY;
window.addEventListener('scroll',()=>{
 const delta=Math.max(-100,Math.min(100,scrollY-previousScroll));previousScroll=scrollY;
 if(!fluid||paused||failed)return;
 const rect=canvas.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)return;
 idleSince=performance.now();
 for(let i=0;i<fluid.n;i++){
  fluid.vy[i]=Math.max(-1100,Math.min(1100,fluid.vy[i]-delta*3.2*parameters.strength*textScale()*(.65+.35*Math.sin(fluid.tx[i]/w*Math.PI))));
  fluid.vx[i]+=Math.sin(fluid.tx[i]*.022)*delta*.18*textScale();
 }
},{passive:true});
new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{try{resize();}catch{showFailure('Die Grafik konnte nicht angepasst werden. Bitte lade die Ansicht neu.');}},100);}).observe(wrap);
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;clearTimeout(holdTimer);pointer.down=false;pointer.id=null;cursor.classList.remove('dragging');resetMotion();quality?.reset();});
reduced.addEventListener('change',e=>{if(e.matches)setPaused(true);});
function frame(t){
 requestAnimationFrame(frame);
 if(document.hidden){last=0;return;}
 const interval=last?t-last:0,dt=Math.min(.04,interval/1000);last=t;
 if(paused||failed||!fluid)return;
 // With fewer particles chosen for a slow processor, a late frame no longer
 // catches up the full time: the liquid briefly slows instead of stuttering.
 const work=performance.now(),cap=(quality?.level.part??0)>=2?1/40:.04;
 settleMotion(t);idleMotion(t);dripsAndBursts(t);
 accumulator=Math.min(cap,accumulator+dt);
 // A pressed pointer drags the liquid; a hovering mouse over the text draws
 // it near like a magnet. Settling phases blend in after a burst or while
 // the letters condense.
 magnet.radius=letterSize*FX.magnetRadius;
 const brush=pointer.down?pointer:magnetOn&&effects.magnet?magnet:null;
 const prm=brush===magnet?{...parameters,strength:FX.magnetStrength}:settle.params(parameters,t);
 while(accumulator>=1/120){
  const tick=1/120;
  fluid.step(tick,prm,brush);accumulator-=tick;
 }
 // Nearly at rest, leftover jitter no longer counts for the look, so the
 // text returns to crisp type instead of lingering as swollen liquid; real
 // displacement still draws as liquid.
 const still=1-Math.max(0,Math.min(1,(meanSpeed(fluid)-12)/48));
 restCalm+=(still-restCalm)*Math.min(1,dt*8);
 liquidCursor.sync(t);
 draw();
 quality?.frame(interval,performance.now()-work);
}
// --------------------------------------------------------------- effects ---
// The letters condense from scattered drops instead of simply appearing.
// Returns whether they do.
function assemble(){
 if(!fluid?.n||!effects.assemble||reduced.matches||paused||failed)return false;
 scatterAround(fluid,Math.min(w,h)*FX.assembleSpread);
 const now=performance.now();idleSince=now;settle.start(now,FX.assembleMs,{viscosity:.3,attraction:.5,homing:2});
 draw();return true;
}
// Everything flies away from the press point; the springs let go for a moment.
function burstAt(x,y){
 if(!fluid||paused)return;
 const now=performance.now();
 burstFrom(fluid,x,y,FX.burstSpeed);
 if(!reduced.matches){fluid.free.fill(1);burstUntil=now+FX.burstFreeMs;drip=null;}
 // The liquid flies free, but the press goes on (see pressAgain).
 pointer.down=false;pointer.dragged=true;pointer.burst=true;pointer.startX=pointer.cx;pointer.startY=pointer.cy;cursor.classList.remove('dragging');idleSince=now;
 settle.start(now,FX.burstFreeMs+2600,{homing:2.5});
 try{navigator.vibrate?.(20);}catch{/* optional */}
}
// Every few quiet seconds a drop detaches from the lowest edge, falls and
// is pulled back; the springs of a burst catch again after a moment.
function dripsAndBursts(t){
 if(burstUntil&&t>burstUntil){fluid.free.fill(0);burstUntil=0;}
 // Still holding after a burst: once the letters are back, the press counts anew.
 if(pointer.burst&&pointer.id!==null&&!pointer.down&&t>settle.until)pressAgain(false);
 if(drip){if(t>drip.until){for(const i of drip.indices)fluid.free[i]=0;drip=null;nextDrip=t+FX.dripMin+Math.random()*(FX.dripMax-FX.dripMin);}}
 else if(t>nextDrip){
  if(effects.drips&&!reduced.matches&&pointer.id===null&&!burstUntil&&isCalm(fluid)){
   const indices=dripIndices(fluid,FX.dripSize);
   for(const i of indices)fluid.free[i]=1;
   drip=indices.length?{indices,until:t+FX.dripFallMs}:null;
  }else nextDrip=t+800;
 }
}
// After a quiet moment an invisible hand drifts through the text.
function idleMotion(t){
 if(!effects.idle||reduced.matches||pointer.down||!centre||t-idleSince<FX.idleDelay){ghost=null;return;}
 const {x,y}=idleHand(centre,(t-idleSince-FX.idleDelay)/1000);
 if(ghost)disturb(x,y,(x-ghost.x)*FX.idleForce*parameters.strength,(y-ghost.y)*FX.idleForce*parameters.strength,pointer.radius*.6);
 ghost={x,y};
}
// Phone motion (see MotionReader): a shake or a quick tilt sloshes the
// liquid, holding the phone still does nothing lasting. Android delivers
// data at once; iOS asks for permission when the switch is tapped.
const motion={reader:new MotionReader(),active:false,waiting:0,listening:false};
const screenAngle=()=>screen.orientation?.angle??window.orientation??0;
screen.orientation?.addEventListener?.('change',()=>motion.reader.relearn());window.addEventListener('orientationchange',()=>motion.reader.relearn());
function onMotion(e){
 const now=performance.now(),r=motion.reader.read(e,now,screenAngle(),{shake:FX.shakeGain,tilt:FX.tiltGain,lean:FX.leanGain});
 if(!r)return;
 if(!motion.active){motion.active=true;clearTimeout(motion.waiting);note();}
 if(r.first)return;
 const k=textScale(),dx=r.nudge.x*k,dy=r.nudge.y*k;
 if(r.aligned&&fluid&&!paused&&!document.hidden&&Math.hypot(dx,dy)>1.5){fluid.nudge(dx,dy);idleSince=now;}
 parameters.gravityX=r.aligned?r.lean.x*k:0;parameters.gravityY=r.aligned?r.lean.y*k:0;
}
// Without fresh sensor data the lean must not linger.
function settleMotion(t){if(motion.reader.last&&t-motion.reader.last>300)parameters.gravityX=parameters.gravityY=0;}
function resetMotion(){parameters.gravityX=parameters.gravityY=0;motion.reader.reset();}
function listenMotion(on){
 window.removeEventListener('devicemotion',onMotion);motion.listening=on;
 if(on)window.addEventListener('devicemotion',onMotion,{passive:true});else{clearTimeout(motion.waiting);resetMotion();}
}
// Switching the sensor on is the user gesture iOS needs; within a moment it
// shows whether the browser delivers motion data at all.
function requestMotion(){
 const ask=typeof DeviceMotionEvent.requestPermission==='function'?DeviceMotionEvent.requestPermission():Promise.resolve('granted');
 return ask.then(state=>{
  if(state!=='granted'){setEffect('motion',false);note('Der Browser hat die Bewegungsdaten nicht freigegeben.');return;}
  listenMotion(true);clearTimeout(motion.waiting);
  motion.waiting=setTimeout(()=>{if(!motion.active){setEffect('motion',false);note('Dieser Browser liefert keine Bewegungsdaten.');}},2500);
 }).catch(()=>{setEffect('motion',false);note('Bewegungsdaten sind hier nicht verfügbar.');});
}
function note(text=''){$('effectNote').textContent=text;$('effectNote').hidden=!text;}
// The pointer's liquid drop over the stage (see cursor.mjs): it swells with
// speed and, near the letters, melts into the liquid wherever it flows.
const coarsePointer=matchMedia('(pointer: coarse)').matches;
const ink=(()=>{const m=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().match(/^#([0-9a-f]{6})$/i);return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)/255):[0,0,0];})();
const liquidCursor=new LiquidCursor({
 host:wrap,ink,reduced,
 liquid:()=>effects.cursor&&fluid?.n&&!paused&&!failed?{fluid,canvas}:null,
 radius:()=>Math.max(coarsePointer?34:18,letterSize*FX.cursorSize),
 options:()=>({count:6,follow:.15,wobble:.4,rest:.05,decay:.995,taper:.7,reach:4,overlap:1.5,meltIn:.33,meltOut:.33,merge:3,line:1,bridge:1}),
});
// The switches below the sliders.
const effectButtons=[...document.querySelectorAll('[data-effect]')];
function setEffect(name,on){
 effects[name]=!!on;
 for(const b of effectButtons)if(b.dataset.effect===name)b.setAttribute('aria-pressed',String(!!on));
 if(name==='cursor'){liquidCursor.enabled=on;if(!on)draw();}
 if(name==='magnet'&&!on)magnetOn=false;
 if(name==='idle'&&!on)ghost=null;
 if(name==='motion'&&!on&&motion.listening)listenMotion(false);
}
const motionPossible=(navigator.maxTouchPoints>0||coarsePointer)&&'DeviceMotionEvent' in window;
const motionNeedsAsking=motionPossible&&typeof DeviceMotionEvent.requestPermission==='function';
for(const b of effectButtons){
 const name=b.dataset.effect;
 // The magnet needs a mouse, the sensor a phone.
 if(name==='magnet')b.hidden=!matchMedia('(hover: hover)').matches;
 if(name==='motion')b.hidden=!motionPossible;
 b.addEventListener('click',()=>{
  const on=!effects[name];note();
  if(name==='motion'&&on){setEffect('motion',true);requestMotion();return;}
  setEffect(name,on);
  if(name==='assemble'&&on)assemble();
 });
}
// Android delivers motion data without asking, so the sensor starts switched
// on; a touch screen without sensor switches it off again after a moment.
if(motionPossible&&!motionNeedsAsking&&!reduced.matches){
 setEffect('motion',true);listenMotion(true);
 motion.waiting=setTimeout(()=>{if(!motion.active)setEffect('motion',false);},2500);
}
// With ?debug the running simulation is reachable from the console.
if(new URLSearchParams(location.search).has('debug'))window.liquidType={get fluid(){return fluid;},get renderer(){return renderer;},get parameters(){return parameters;},get effects(){return effects;},get cursor(){return liquidCursor.chain;},get drip(){return drip;},get motion(){return motion;},get strokeRatio(){return strokeRatio;},get letterSize(){return letterSize;},setEffect};

setup();updateStatus();requestAnimationFrame(frame);
// Expose the same visible controls to compatible browsers; no network or storage.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 try{Promise.resolve(document.modelContext.registerTool({
  name:'configure_liquid_type',title:'Flüssigkeitsschrift einstellen',description:'Ändert den sichtbaren Text, die Physikregler, die Effekte oder den Pausenstatus der lokalen Animation.',
  inputSchema:{type:'object',properties:{text:{type:'string',maxLength:32},viscosity:{type:'number',minimum:0,maximum:100},tension:{type:'number',minimum:0,maximum:100},attraction:{type:'number',minimum:0,maximum:100},strength:{type:'number',minimum:0,maximum:100},paused:{type:'boolean'},
   effects:{type:'object',description:'Effekte ein- oder ausschalten.',properties:Object.fromEntries(EFFECTS.map(k=>[k,{type:'boolean'}])),additionalProperties:false}},additionalProperties:false},
  annotations:{readOnlyHint:false,untrustedContentHint:false},
  execute(value){
   if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ein Einstellungsobjekt wird benötigt.');
   for(const key of Object.keys(value))if(![...controls,'text','paused','effects'].includes(key))throw new Error('Unbekannte Einstellung.');
   if(value.effects!==undefined){
    if(!value.effects||typeof value.effects!=='object'||Array.isArray(value.effects))throw new Error('effects muss ein Objekt sein.');
    for(const [k,v] of Object.entries(value.effects))if(!EFFECTS.includes(k)||typeof v!=='boolean')throw new Error('Unbekannter Effekt oder kein Wahrheitswert.');
   }
   if(value.text!==undefined&&(typeof value.text!=='string'||Array.from(value.text).length>32))throw new Error('Text darf höchstens 32 Zeichen enthalten.');
   for(const key of controls)if(value[key]!==undefined&&(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<0||value[key]>100))throw new Error('Regler müssen zwischen 0 und 100 liegen.');
   if(value.paused!==undefined&&typeof value.paused!=='boolean')throw new Error('paused muss ein Wahrheitswert sein.');
   if(value.text!==undefined){clearTimeout(textTimer);setText(value.text);}
   for(const key of controls)if(value[key]!==undefined)setParameter(key,value[key]);
   if(value.paused!==undefined)setPaused(value.paused);
   // The phone sensor only starts from a tap (iOS asks then); here it can only be switched off.
   for(const [k,v] of Object.entries(value.effects||{}))if(k!=='motion'||!v)setEffect(k,v);
   return{text:input.value,paused,particles:fluid?.n??0,...Object.fromEntries(controls.map(k=>[k,Number($(k).value)])),effects:{...effects}};
  }
 },{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser API; the visible controls remain available. */}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
