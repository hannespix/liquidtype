import test from 'node:test';
import assert from 'node:assert/strict';
import {Fluid} from '../src/physics.mjs';
test('all controls at 100% preserve rest and physically settle after dragging',()=>{
 const points=Array.from({length:80},(_,i)=>({x:100+i%10*6,y:100+Math.floor(i/10)*6}));
 const f=new Fluid(points,800,500,6),p={viscosity:1,tension:1,attraction:1,strength:2.1};
 const error=()=>Math.max(...f.x.map((x,i)=>Math.hypot(x-f.tx[i],f.y[i]-f.ty[i])));
 for(let i=0;i<180;i++)f.step(1/120,p);assert.ok(error()<.001);
 f.impulse(120,120,220,-90,70);for(let i=0;i<20;i++)f.step(1/120,p);assert.ok(error()>5);
 for(let i=0;i<2400;i++)f.step(1/120,p);assert.ok(error()<.05);
});
