import test from 'node:test';
import assert from 'node:assert/strict';
import {guessLevels,createQuality,RESOLUTION,PARTICLES} from '../src/quality.mjs';

const gpu=name=>({RENDERER:0x1F01,getParameter:()=>name,getExtension:()=>null});
const strong={cores:8,memory:8};

test('a strong device starts at full quality',()=>{
 assert.deepEqual(guessLevels(gpu('ANGLE (Apple, Apple M2, OpenGL 4.1)'),strong),{res:0,part:0});
});
test('software rendering, few cores, little memory and old chips start lower',()=>{
 assert.deepEqual(guessLevels(gpu('Google SwiftShader'),strong),{res:2,part:1});
 assert.equal(guessLevels(gpu('Mali-G52'),{cores:2,memory:8}).part,2);
 assert.equal(guessLevels(gpu('Mali-G52'),{cores:4,memory:8}).part,1);
 assert.deepEqual(guessLevels(gpu('Adreno (TM) 506'),{cores:8,memory:2}),{res:1,part:2});
 assert.equal(guessLevels(gpu('Adreno (TM) 610'),{cores:8,memory:4}).res,1);
 assert.equal(guessLevels(gpu('Mali-T760'),{...strong,floatSurface:false}).res,1);
 // Unknown reports (Safari, Firefox) change nothing.
 assert.deepEqual(guessLevels(gpu('Apple GPU'),{cores:0,memory:0}),{res:0,part:0});
});

const run=(q,frames,interval,work)=>{for(let i=0;i<frames;i++)q.frame(interval,work);};
const WARM=45;

test('slow drawing turns the resolution down, a busy processor the particles',()=>{
 const drawing=[],busy=[];
 const gpuBound=createQuality(gpu('Apple GPU'),{search:'',hints:strong,onChange:c=>drawing.push(c.changed)});
 assert.equal(gpuBound.resolution,RESOLUTION[0]);assert.equal(gpuBound.particles,PARTICLES[0]);
 run(gpuBound,200,16.7,4);
 assert.deepEqual(drawing,[],'60 frames per second keep full quality');
 run(gpuBound,WARM+40,30,4);
 assert.deepEqual(drawing,['resolution'],'little own work: the graphics chip is the limit');
 assert.equal(gpuBound.resolution,RESOLUTION[1]);
 const cpuBound=createQuality(gpu('Apple GPU'),{search:'',hints:strong,onChange:c=>busy.push(c.changed)});
 run(cpuBound,WARM+40,30,24);
 assert.deepEqual(busy,['particles'],'own work fills the frame: the processor is the limit');
 assert.equal(cpuBound.particles,PARTICLES[1]);
});

test('a screen capped at 30 frames per second loses one notch at most',()=>{
 const capped=createQuality(gpu('Apple GPU'),{search:'',hints:strong});
 run(capped,2000,33.3,4);
 assert.deepEqual(capped.level,{res:1,part:0});
 // A struggling device with uneven frames goes all the way down.
 const weak=createQuality(gpu('Apple GPU'),{search:'',hints:strong});
 for(let i=0;i<3000;i++)weak.frame(i%3?45:70,i%2?50:10);
 assert.deepEqual(weak.level,{res:RESOLUTION.length-1,part:PARTICLES.length-1});
});

test('pauses and very long frames do not count',()=>{
 const changes=[];
 const q=createQuality(gpu('Apple GPU'),{search:'',hints:strong,onChange:c=>changes.push(c)});
 run(q,200,400,2);
 for(let i=0;i<50;i++){run(q,30,40,2);q.reset();}
 assert.deepEqual(changes,[]);
});

test('?quality fixes both dials and stops watching',()=>{
 const full=createQuality(gpu('Google SwiftShader'),{search:'?quality=0',hints:{cores:1,memory:1}});
 assert.deepEqual(full.level,{res:0,part:0});
 run(full,500,80,70);
 assert.deepEqual(full.level,{res:0,part:0});
 assert.deepEqual(createQuality(gpu('Apple GPU'),{search:'?quality=3'}).level,{res:3,part:3});
});
