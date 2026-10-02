import {Fluid} from './physics.mjs?v=5104613e';
import {FluidRenderer} from './render.mjs?v=5104613e';
import {sampleGlyphs} from './glyphs.mjs?v=5104613e';
const $=id=>document.getElementById(id);
const canvas=$('fluid'),wrap=$('canvasWrap'),input=$('textInput'),cursor=$('cursor');
// No alternate text layer: the only visible typography is the particle surface.
function disturb(x,y,dx,dy,radius){
 if(Math.abs(dx)+Math.abs(dy)<.1)return;
 fluid.impulse(x,y,dx,dy,radius);
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const controls=['viscosity','tension','attraction','strength'];
const parameters={viscosity:.35,tension:.65,attraction:.5,strength:1.3};
let renderer=null,fluid=null,paused=reduced.matches,failed=false,w=0,h=0,last=0,accumulator=0,textTimer,resizeTimer;
const pointer={x:-1000,y:-1000,down:false,radius:95,id:null,last:0};
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
 if(!text.trim()){const blank=document.createElement('canvas');blank.width=blank.height=1;renderer?.setMaterial(blank);return{points:[],spacing:5};}
 const ctx=document.createElement('canvas').getContext('2d');
 let size=Math.min(height*.63,width*.7,330);ctx.font=`500 ${size}px Georgia, 'Times New Roman', serif`;
 const measured=ctx.measureText(text).width;size*=Math.min(1,width*.86/Math.max(1,measured));ctx.font=`500 ${size}px Georgia, 'Times New Roman', serif`;
 const m=ctx.measureText(text),font=ctx.font,baseline=height/2+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2;
 const {points,spacing,material}=sampleGlyphs(width,height,g=>{g.font=font;g.textAlign='center';g.fillStyle='black';g.fillText(text,width/2,baseline);},width<700?2200:4200);
 renderer?.setMaterial(material);
 return {points,spacing};
}
function setText(value,animate=true){
 input.value=Array.from(value).slice(0,32).join('');const text=input.value;
 $('charCount').textContent=Array.from(text).length+' / 32';$('fallbackText').textContent=text;
 $('emptyNote').hidden=!!text.trim();canvas.setAttribute('aria-label',`Flüssige Schrift ${text||'– leer'}. Mit Maus oder Finger ziehen. Mit Pfeiltasten Wellen erzeugen.`);
 if(!w||!h)return;
 const old=fluid;const {points,spacing}=maskPoints(text,w,h);fluid=new Fluid(points,w,h,spacing);
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
function draw(){if(renderer&&fluid&&!failed)renderer.draw(fluid);}
function showFailure(message){failed=true;canvas.style.visibility='hidden';$('fallback').hidden=false;$('fallbackMessage').textContent=message;cursor.style.display='none';updateStatus();}
function setup(){
 try{
  renderer=new FluidRenderer(canvas);failed=false;canvas.style.visibility='visible';$('fallback').hidden=true;
  resize();updateStatus();
 }catch(error){console.warn('Liquid Type graphics:',error);showFailure('Die interaktive Grafik ist gerade nicht verfügbar. Bitte versuche es mit aktivierter Hardwarebeschleunigung in einem aktuellen Browser.');}
}
function resize(){
 const rect=wrap.getBoundingClientRect();const nw=Math.max(100,Math.round(rect.width)),nh=Math.max(160,Math.round(rect.height));
 if(nw===w&&nh===h&&fluid&&renderer?.w===w)return;w=nw;h=nh;pointer.radius=Math.max(60,Math.min(110,w*.13));
 if(renderer&&!failed)renderer.resize(w,h);setText(input.value,false);
}
input.addEventListener('input',()=>{clearTimeout(textTimer);$('charCount').textContent=Array.from(input.value).length+' / 32';textTimer=setTimeout(()=>setText(input.value),130);});
input.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(textTimer);setText(input.value);input.blur();}});
$('pause').addEventListener('click',()=>setPaused(!paused));
$('reset').addEventListener('click',()=>{fluid?.reset();pointer.down=false;draw();});
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
 pointer.x=x;pointer.y=y;pointer.last=now;cursor.style.left=x+'px';cursor.style.top=y+'px';
 if(e.pointerType==='mouse'&&!failed)cursor.style.display='grid';
}
canvas.addEventListener('pointerdown',e=>{if(pointer.id!==null||failed)return;move(e);pointer.id=e.pointerId;pointer.down=!paused;canvas.setPointerCapture(e.pointerId);cursor.classList.toggle('dragging',pointer.down);});
canvas.addEventListener('pointermove',e=>{if(pointer.id!==null&&e.pointerId!==pointer.id)return;move(e);});
function release(e){if(pointer.id!==null&&e.pointerId!==pointer.id)return;pointer.down=false;pointer.id=null;cursor.classList.remove('dragging');}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
canvas.addEventListener('pointerleave',()=>{cursor.style.display='none';if(!pointer.down)pointer.last=0;});
canvas.addEventListener('keydown',e=>{
 if(e.key===' '){e.preventDefault();setPaused(!paused);return;}
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
  e.preventDefault();if(fluid&&!paused){const dx=e.key==='ArrowLeft'?-420:e.key==='ArrowRight'?420:0,dy=e.key==='ArrowUp'?-420:e.key==='ArrowDown'?420:0;fluid.impulse(w/2,h/2,dx,dy,Math.max(w,h));}
 }
});
let previousScroll=scrollY;
window.addEventListener('scroll',()=>{
 const delta=Math.max(-100,Math.min(100,scrollY-previousScroll));previousScroll=scrollY;
 if(!fluid||paused||failed)return;
 const rect=canvas.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)return;
 for(let i=0;i<fluid.n;i++){
  fluid.vy[i]=Math.max(-1100,Math.min(1100,fluid.vy[i]-delta*3.2*parameters.strength*(.65+.35*Math.sin(fluid.tx[i]/w*Math.PI))));
  fluid.vx[i]+=Math.sin(fluid.tx[i]*.022)*delta*.18;
 }
},{passive:true});
new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{try{resize();}catch{showFailure('Die Grafik konnte nicht angepasst werden. Bitte lade die Ansicht neu.');}},100);}).observe(wrap);
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;pointer.down=false;pointer.id=null;cursor.classList.remove('dragging');});
reduced.addEventListener('change',e=>{if(e.matches)setPaused(true);});
function frame(t){
 requestAnimationFrame(frame);
 if(document.hidden){last=0;return;}
 const dt=last?Math.min(.04,(t-last)/1000):0;last=t;
 if(paused||failed||!fluid)return;
 accumulator=Math.min(.04,accumulator+dt);
 while(accumulator>=1/120){
  const tick=1/120;
  fluid.step(tick,parameters,pointer);accumulator-=tick;
 }
 draw();
}
setup();updateStatus();requestAnimationFrame(frame);
// Expose the same visible controls to compatible browsers; no network or storage.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 try{Promise.resolve(document.modelContext.registerTool({
  name:'configure_liquid_type',title:'Flüssigkeitsschrift einstellen',description:'Ändert den sichtbaren Text, die Physikregler oder den Pausenstatus der lokalen Animation.',
  inputSchema:{type:'object',properties:{text:{type:'string',maxLength:32},viscosity:{type:'number',minimum:0,maximum:100},tension:{type:'number',minimum:0,maximum:100},attraction:{type:'number',minimum:0,maximum:100},strength:{type:'number',minimum:0,maximum:100},paused:{type:'boolean'}},additionalProperties:false},
  annotations:{readOnlyHint:false,untrustedContentHint:false},
  execute(value){
   if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ein Einstellungsobjekt wird benötigt.');
   for(const key of Object.keys(value))if(![...controls,'text','paused'].includes(key))throw new Error('Unbekannte Einstellung.');
   if(value.text!==undefined&&(typeof value.text!=='string'||Array.from(value.text).length>32))throw new Error('Text darf höchstens 32 Zeichen enthalten.');
   for(const key of controls)if(value[key]!==undefined&&(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<0||value[key]>100))throw new Error('Regler müssen zwischen 0 und 100 liegen.');
   if(value.paused!==undefined&&typeof value.paused!=='boolean')throw new Error('paused muss ein Wahrheitswert sein.');
   if(value.text!==undefined){clearTimeout(textTimer);setText(value.text);}
   for(const key of controls)if(value[key]!==undefined)setParameter(key,value[key]);
   if(value.paused!==undefined)setPaused(value.paused);
   return{text:input.value,paused,particles:fluid?.n??0,...Object.fromEntries(controls.map(k=>[k,Number($(k).value)]))};
  }
 },{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser API; the visible controls remain available. */}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
