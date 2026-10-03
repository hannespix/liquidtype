// Quality for slow and old devices, shared by every Liquid Type page.
// Two dials: the drawing resolution (device pixels per CSS pixel) for weak
// graphics chips, and the share of particles for weak processors. A first
// guess comes from what the device reports about itself; after that the
// frame rate decides. When frames stay slow, the dial that costs the time is
// turned down one notch: the processor's if the page's own work fills most of
// the frame, otherwise the graphics chip's. Dials never turn back up within a
// visit, so the picture does not pump. Strong devices keep full quality.
export const RESOLUTION=[2,1.5,1,.75];
export const PARTICLES=[1,.8,.62,.48];
const KEY='lt-quality',SLOW_MS=22,VERY_SLOW_MS=40,WINDOW=40,WARMUP=45,LONGEST_MS=250;
const clampLevel=v=>Math.max(0,Math.min(RESOLUTION.length-1,v|0));

// A first guess from the device's own reports: software rendering, few
// cores, little memory or no float render targets mean an old or weak device.
export function guessLevels(gl,{cores=globalThis.navigator?.hardwareConcurrency,memory=globalThis.navigator?.deviceMemory,floatSurface=true}={}){
 let res=0,part=0;
 let name='';
 try{
  name=String(gl?.getParameter(gl.RENDERER)||'');
  if(/^webkit webgl$/i.test(name)){const info=gl.getExtension('WEBGL_debug_renderer_info');if(info)name=String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)||name);}
 }catch{/* renderer name is optional */}
 if(/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)){res=Math.max(res,2);part=Math.max(part,1);}
 if(cores>0&&cores<=2)part=Math.max(part,2);else if(cores>0&&cores<=4)part=Math.max(part,1);
 if(memory>0&&memory<=2){part=Math.max(part,2);res=Math.max(res,1);}else if(memory>0&&memory<=4)res=Math.max(res,1);
 if(!floatSurface)res=Math.max(res,1);
 return {res,part};
}

// `onChange({resolution,particles,changed})` runs after a dial moved
// ('resolution' or 'particles'). `?quality=0` (full) to `?quality=3` (lowest)
// fixes both dials and switches the watching off, e.g. for comparisons.
export function createQuality(gl,{floatSurface=true,onChange=()=>{},search=globalThis.location?.search||'',hints}={}){
 const forced=new URLSearchParams(search).get('quality');
 let res=0,part=0,watching=true;
 if(forced!==null&&/^[0-3]$/.test(forced)){res=part=Number(forced);watching=false;}
 else{
  const guess=guessLevels(gl,{floatSurface,...hints});
  let saved={};try{saved=JSON.parse(globalThis.sessionStorage?.getItem(KEY)||'{}');}catch{/* storage unavailable */}
  res=clampLevel(Math.max(guess.res,saved.res|0));part=clampLevel(Math.max(guess.part,saved.part|0));
 }
 const intervals=[],works=[];let warm=WARMUP;
 const sorted=a=>[...a].sort((x,y)=>x-y);
 const q={
  get resolution(){return RESOLUTION[res];},
  get particles(){return PARTICLES[part];},
  get level(){return {res,part};},
  // Forget recent frames, e.g. after a pause, a resize or a new shape.
  reset(){intervals.length=works.length=0;warm=WARMUP;},
  // One drawn frame: time since the previous one and the page's own work in
  // it, both in ms.
  frame(interval,work){
   if(!watching||!(interval>0))return;
   if(interval>LONGEST_MS){q.reset();return;}
   if(warm>0){warm--;return;}
   intervals.push(interval);works.push(work);
   if(intervals.length<WINDOW)return;
   const spans=sorted(intervals),slow=spans[spans.length>>1],busy=sorted(works)[works.length>>1];
   intervals.shift();works.shift();
   if(slow<=SLOW_MS)return;
   let changed=null;
   // Evenly spaced frames near 30 per second with little own work are most
   // likely a capped screen (a phone saving power), not a weak device: one
   // resolution notch at most, then the watching stops.
   const steady=slow>28&&slow<38&&spans[Math.floor(spans.length*.9)]-spans[Math.floor(spans.length*.1)]<4&&busy<slow*.3;
   if(steady){if(res>0){watching=false;return;}res++;changed='resolution';}
   else{
    // The last notch of either dial only for clearly struggling devices.
    const room=level=>level<RESOLUTION.length-2||(level<RESOLUTION.length-1&&slow>VERY_SLOW_MS);
    if(busy>slow*.55&&room(part)){part++;changed='particles';}
    else if(room(res)){res++;changed='resolution';}
    else if(room(part)){part++;changed='particles';}
    if(!changed){if(res===RESOLUTION.length-1&&part===PARTICLES.length-1)watching=false;return;}
   }
   try{globalThis.sessionStorage?.setItem(KEY,JSON.stringify({res,part}));}catch{/* storage unavailable */}
   q.reset();
   onChange({resolution:RESOLUTION[res],particles:PARTICLES[part],changed});
  },
 };
 return q;
}
