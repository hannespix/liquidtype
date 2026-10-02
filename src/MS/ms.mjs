// Matthias Sütterlin study: the initials M and S run on the Liquid Type engine.
import {Fluid} from '../physics.mjs';
import {FluidRenderer} from '../render.mjs';
import {sampleGlyphs} from '../glyphs.mjs';

const $=id=>document.getElementById(id);
const home=$('home'),canvas=$('liquid'),initials=$('initials'),intro=$('intro'),back=$('back'),crumb=$('crumb');
const letters=[...initials.querySelectorAll('.initial')];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const parameters={viscosity:.35,tension:.65,attraction:.5,strength:1.3};
const pointer={x:0,y:0,down:false,radius:80,id:null,last:0,startX:0,startY:0,dragged:false};
const IDLE_DELAY=5000,IDLE_FORCE=1.6;
let renderer=null,fluid=null,w=0,h=0,last=0,accumulator=0,layoutKey='',rebuildTimer=0;
let idleSince=performance.now(),suppressClickUntil=0,ghost=null,centre=null;
const isHome=()=>home.classList.contains('is-active');

// ---------------------------------------------------------------- liquid ---
function createRenderer(){
 try{renderer=new FluidRenderer(canvas,{paper:[1,1,1],ink:[0,0,0]});w=h=0;home.classList.remove('no-liquid');}
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
 if(!renderer||!isHome())return;
 const box=home.getBoundingClientRect(),nw=Math.round(box.width),nh=Math.round(box.height);
 if(nw<2||nh<2)return;
 const layout=glyphLayout();
 const key=[nw,nh,...layout.map(l=>[l.x,l.y,l.height,l.font].join())].join('|');
 if(!force&&key===layoutKey&&fluid)return;
 layoutKey=key;
 if(nw!==w||nh!==h){w=nw;h=nh;renderer.resize(w,h);}
 const {points,spacing,material}=sampleGlyphs(w,h,g=>paint(g,layout),w<700?2200:4200);
 renderer.setMaterial(material);
 fluid=new Fluid(points,w,h,spacing);
 const left=Math.min(...layout.map(l=>l.x)),right=Math.max(...layout.map(l=>l.x+l.width));
 const size=layout[0]?.size||200;
 centre={x:(left+right)/2,y:layout[0]?layout[0].y+layout[0].height/2:h/2,rx:(right-left)*.42,ry:size*.3};
 pointer.radius=Math.max(50,Math.min(110,size*.32));
 ghost=null;draw();
}
function scheduleRebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>rebuild(),120);}
function draw(){if(renderer&&fluid)renderer.draw(fluid);}
function local(e){const r=home.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function disturb(x,y,dx,dy,radius){if(fluid&&Math.abs(dx)+Math.abs(dy)>=.1)fluid.impulse(x,y,dx,dy,radius);}

home.addEventListener('pointerdown',e=>{
 if(!fluid||pointer.id!==null||e.button>0||e.target.closest('a, .link, .line-hit'))return;
 const p=local(e);
 Object.assign(pointer,{x:p.x,y:p.y,startX:e.clientX,startY:e.clientY,down:true,id:e.pointerId,last:performance.now(),dragged:false});
 idleSince=performance.now();
});
window.addEventListener('pointermove',e=>{
 if(!fluid||!isHome()||(pointer.id!==null&&e.pointerId!==pointer.id))return;
 if(pointer.down&&e.pointerType==='mouse'&&e.buttons===0)release(e);
 const p=local(e),now=performance.now();
 if(pointer.last){
  const dx=p.x-pointer.x,dy=p.y-pointer.y;
  if(pointer.down)disturb(p.x,p.y,dx*16*parameters.strength,dy*16*parameters.strength,pointer.radius);
  else if(e.pointerType==='mouse'&&Math.hypot(dx,dy)<100)disturb(p.x,p.y,dx*2.5*parameters.strength,dy*2.5*parameters.strength,pointer.radius*.65);
 }
 if(pointer.down&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>8)pointer.dragged=true;
 pointer.x=p.x;pointer.y=p.y;pointer.last=now;idleSince=now;
},{passive:true});
function release(e){
 if(pointer.id===null||(e&&e.pointerId!==pointer.id))return;
 // A drag that ends on a letter must not also open "Über mich".
 if(pointer.dragged)suppressClickUntil=performance.now()+400;
 pointer.down=false;pointer.id=null;pointer.dragged=false;
}
window.addEventListener('pointerup',release);
window.addEventListener('pointercancel',release);
document.documentElement.addEventListener('pointerleave',()=>{if(!pointer.down)pointer.last=0;});
initials.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.stopPropagation();e.preventDefault();}},true);
// Arrow keys on a focused letter send a wave through the liquid.
initials.addEventListener('keydown',e=>{
 const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
 if(!dir||!fluid||!centre)return;
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
 if(document.hidden||!isHome()||!fluid||!renderer){last=0;return;}
 const dt=last?Math.min(.04,(t-last)/1000):0;last=t;
 idleMotion(t);
 accumulator=Math.min(.04,accumulator+dt);
 while(accumulator>=1/120){fluid.step(1/120,parameters,pointer);accumulator-=1/120;}
 draw();
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;fluid=null;home.classList.add('no-liquid');});
canvas.addEventListener('webglcontextrestored',()=>{createRenderer();rebuild(true);});
new ResizeObserver(scheduleRebuild).observe(home);
new ResizeObserver(scheduleRebuild).observe(initials);
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;release({pointerId:pointer.id});});

// ------------------------------------------------------------ navigation ---
const views=new Map([...document.querySelectorAll('.view')].map(v=>[v.dataset.view,v]));
const parents={about:'home',projects:'home',contact:'home',fernen:'projects',adac:'projects',dreamco:'projects'};
const baseTitle=document.title;
let current=null;
function viewFromHash(){const name=decodeURIComponent(location.hash.slice(1));return views.has(name)?name:'home';}
function show(name,focus=true){
 if(!views.has(name))name='home';
 if(name===current)return;
 current=name;
 for(const [key,view] of views){const on=key===name;view.hidden=!on;view.classList.toggle('is-active',on);}
 const label=views.get(name).getAttribute('aria-label');
 back.hidden=name==='home';crumb.textContent=label;
 document.title=name==='home'?baseTitle:`${label} — Matthias Sütterlin`;
 window.scrollTo(0,0);
 if(name==='home'){release({pointerId:pointer.id});last=0;idleSince=performance.now();requestAnimationFrame(()=>rebuild());}
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
function pluckable(host){
 host.classList.add('line');host.setAttribute('aria-hidden','true');
 const svg=document.createElementNS(SVG,'svg'),path=document.createElementNS(SVG,'path'),hit=document.createElement('div');
 hit.className='line-hit';svg.append(path);host.append(svg,hit);
 const mid=200;
 let width=0,offset=0,velocity=0,anchor=.5,grabbed=false,previous=null,raf=0,then=0;
 const snap=()=>Math.max(70,Math.min(160,innerHeight*.18));
 function render(){
  const o=Math.max(-snap(),Math.min(snap(),offset));
  path.setAttribute('d',`M0 ${mid} Q${(width*anchor).toFixed(1)} ${(mid+o*2).toFixed(1)} ${width} ${mid}`);
 }
 function fit(){
  const left=host.getBoundingClientRect().left;width=document.documentElement.clientWidth;
  for(const el of [svg,hit]){el.style.left=-left+'px';el.style.width=width+'px';}
  render();
 }
 // Damped spring: the released line swings out and settles.
 function swing(t){
  const dt=then?Math.min(1/30,(t-then)/1000):1/60;then=t;
  velocity+=-620*offset*dt;velocity*=Math.exp(-4.2*dt);offset+=velocity*dt;
  if(Math.abs(offset)<.15&&Math.abs(velocity)<3){offset=velocity=0;raf=0;then=0;render();return;}
  render();raf=requestAnimationFrame(swing);
 }
 function grab(){grabbed=true;cancelAnimationFrame(raf);raf=0;then=0;velocity=0;}
 function letGo(){
  if(!grabbed)return;grabbed=false;
  offset=Math.max(-snap(),Math.min(snap(),offset));
  if(reducedMotion.matches){offset=0;render();}else if(!raf)raf=requestAnimationFrame(swing);
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
}
document.querySelectorAll('.panel h2').forEach(h2=>{const line=document.createElement('div');h2.after(line);pluckable(line);});
document.querySelectorAll('[data-line]').forEach(pluckable);

// ----------------------------------------------------------------- start ---
show(viewFromHash(),false);
let introSeen=false;try{introSeen=sessionStorage.getItem('ms-intro-seen')==='1';}catch{/* storage unavailable */}
if(!introSeen&&current==='home'&&typeof intro.showModal==='function'){intro.showModal();setTimeout(closeIntro,12000);}
createRenderer();
try{await document.fonts?.load('700 100px "Playfair Display"');}catch{/* fallback serif */}
rebuild(true);
document.fonts?.ready.then(()=>rebuild());
requestAnimationFrame(frame);
