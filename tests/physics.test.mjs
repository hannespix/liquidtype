import test from 'node:test';
import assert from 'node:assert/strict';
import {Fluid} from '../src/physics.mjs';
const params={viscosity:.5,tension:.6,attraction:.5,strength:1};
test('empty fluid and long background delta stay valid',()=>{
 const f=new Fluid([],800,500,6);f.step(500,params);assert.equal(f.x.length,0);
});
test('displaced liquid returns to its letter',()=>{
 const f=new Fluid([{x:200,y:200}],800,500,6);f.x[0]+=90;
 for(let i=0;i<600;i++)f.step(1/120,params);
 assert.ok(Math.abs(f.x[0]-200)<3);
});
test('symmetric disturbance produces reciprocal particle response',()=>{
 const f=new Fluid([{x:200,y:200},{x:211,y:200}],800,500,6);
 f.x[0]+=1;f.x[1]-=1;f.step(1/120,params);
 assert.ok(Math.abs(f.vx[0])+Math.abs(f.vx[1])>0);assert.ok(Math.abs(f.vx[0]+f.vx[1])<1e-5);
});
test('coincident particles and violent dragging remain finite and bounded',()=>{
 const points=Array.from({length:150},(_,i)=>({x:200+(i%15)*6,y:160+Math.floor(i/15)*6}));
 const f=new Fluid(points,800,500,6);f.x[1]=f.x[0];f.y[1]=f.y[0];
 for(let i=0;i<1600;i++){
  if(i%20===0)f.impulse(240,190,1e6,-1e6,300);
  f.step(i%50===0?5:1/120,params);
  for(let j=0;j<f.x.length;j++)assert.ok(Number.isFinite(f.x[j])&&Number.isFinite(f.y[j])&&Math.abs(f.vx[j])<=1600&&f.x[j]>=0&&f.x[j]<=800&&f.y[j]>=0&&f.y[j]<=500);
 }
});
test('zero timestep does not move fluid, reset restores it',()=>{
 const f=new Fluid([{x:100,y:80}],800,500,6);f.impulse(100,80,100,50,50);f.step(0,params);assert.equal(f.x[0],100);
 f.step(.01,params);assert.notEqual(f.x[0],100);f.reset();assert.equal(f.x[0],100);assert.equal(f.vx[0],0);
});
