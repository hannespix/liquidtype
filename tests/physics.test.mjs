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
test('uniform gravity displaces the liquid and it returns once removed',()=>{
 const f=new Fluid([{x:200,y:200}],800,500,6);
 for(let i=0;i<300;i++)f.step(1/120,{...params,gravityY:1500});
 assert.ok(f.y[0]>202,'sags with gravity');assert.equal(f.x[0],200);
 for(let i=0;i<600;i++)f.step(1/120,params);
 assert.ok(Math.abs(f.y[0]-200)<.5,'returns without gravity');
});
test('nudge adds a bounded, slightly varied velocity to every particle',()=>{
 const f=new Fluid([{x:100,y:100},{x:300,y:260}],800,500,6);
 f.nudge(200,-50);
 for(let i=0;i<2;i++){assert.ok(f.vx[i]>=100&&f.vx[i]<=200);assert.ok(f.vy[i]<=-25&&f.vy[i]>=-50);}
 assert.notEqual(f.vx[0],f.vx[1]);
 f.nudge(5000,5000);assert.ok(Math.abs(f.vx[0])<=1500&&Math.abs(f.vy[0])<=1500);
});
test('a released particle falls under drip gravity, neighbours stay, capture brings it back',()=>{
 const f=new Fluid([{x:200,y:200},{x:206,y:200}],800,500,6);
 f.free[0]=1;
 for(let i=0;i<60;i++)f.step(1/120,{...params,dripGravity:1500});
 assert.ok(f.y[0]>300,'fell');assert.ok(Math.abs(f.y[1]-200)<3,'neighbour held by its spring');
 f.free[0]=0;
 for(let i=0;i<900;i++)f.step(1/120,{...params,dripGravity:1500});
 assert.ok(Math.abs(f.y[0]-200)<1,'returned');
 f.free[0]=1;f.reset();assert.equal(f.free[0],0);
});
test('homing pulls displaced liquid home sooner, default is unchanged',()=>{
 const arrival=p=>{const f=new Fluid([{x:200,y:200}],800,500,6);f.x[0]+=120;for(let i=1;i<=600;i++){f.step(1/120,p);if(Math.abs(f.x[0]-200)<10)return i;}return 601;};
 const plain=arrival(params),strong=arrival({...params,homing:2.5});
 assert.ok(strong<plain*.75,`arrives sooner: ${strong} vs ${plain} steps`);
 const a=new Fluid([{x:200,y:200}],800,500,6),b=new Fluid([{x:200,y:200}],800,500,6);a.x[0]+=50;b.x[0]+=50;
 for(let i=0;i<30;i++){a.step(1/120,params);b.step(1/120,{...params,homing:1});}
 assert.equal(a.x[0],b.x[0]);
});
test('solo particles ignore their neighbours but still return home',()=>{
 const pair=solo=>{const f=new Fluid([{x:200,y:200},{x:206,y:200}],800,500,6);f.x[0]+=2;f.step(1/120,{...params,solo});return f.vx[1];};
 assert.notEqual(pair(false),0,'neighbour feels the push');assert.equal(pair(true),0,'solo neighbour does not');
 const f=new Fluid([{x:200,y:200}],800,500,6);f.x[0]+=80;for(let i=0;i<900;i++)f.step(1/120,{...params,solo:true,homing:3});
 assert.ok(Math.abs(f.x[0]-200)<.5);
});
test('drag lets a solo particle arrive without overshooting',()=>{
 const run=drag=>{const f=new Fluid([{x:200,y:200}],800,500,2.5);f.x[0]+=150;let min=Infinity;for(let i=0;i<144;i++){f.step(1/120,{...params,solo:true,homing:5,drag});min=Math.min(min,f.x[0]);}return {overshoot:200-min,end:Math.abs(f.x[0]-200)};};
 const loose=run(0),damped=run(26);
 assert.ok(loose.overshoot>20,`undamped overshoots: ${loose.overshoot}`);
 assert.ok(damped.overshoot<2,`damped barely overshoots: ${damped.overshoot}`);
 assert.ok(damped.end<1.5,`and is home within 1.2 s: ${damped.end}`);
});
test('solo flights converge the same with large steps',()=>{
 // Page flights step at 1/60 s; with drag they must stay stable and arrive.
 const f=new Fluid([{x:200,y:200},{x:204,y:200}],800,500,1.5);
 f.x[0]+=180;f.y[1]-=150;
 const p={...params,homing:5,solo:true,drag:26};
 for(let i=0;i<66;i++)f.step(1/60,{...p,homing:i>46?20:5});
 assert.ok(Math.hypot(f.x[0]-200,f.y[0]-200)<1,`first ${f.x[0]},${f.y[0]}`);
 assert.ok(Math.hypot(f.x[1]-204,f.y[1]-200)<1,`second ${f.x[1]},${f.y[1]}`);
});
