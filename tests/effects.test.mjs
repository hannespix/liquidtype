import test from 'node:test';
import assert from 'node:assert/strict';
import {Fluid} from '../src/physics.mjs';
import {scatterAround,burstFrom,isCalm,dripIndices,Settle,idleHand} from '../src/effects.mjs';

// A block of liquid 20 × 10 drops, 6 px apart, in a 400 × 300 canvas.
const block=()=>{const points=[];for(let y=0;y<10;y++)for(let x=0;x<20;x++)points.push({x:140+x*6,y:120+y*6});return new Fluid(points,400,300,6);};
const seeded=(s=1)=>()=>(s=(s*16807)%2147483647)/2147483647;

test('scattering spreads the drops around their targets, at rest and inside the canvas',()=>{
 const f=block();scatterAround(f,80,seeded());
 let moved=0;
 for(let i=0;i<f.n;i++){
  const d=Math.hypot(f.x[i]-f.tx[i],f.y[i]-f.ty[i]);
  assert.ok(d<=80+1e-9,'within the spread');if(d>5)moved++;
  assert.ok(f.x[i]>=6&&f.x[i]<=394&&f.y[i]>=6&&f.y[i]<=294,'inside');
  assert.equal(f.vx[i],0);assert.equal(f.vy[i],0);
 }
 assert.ok(moved>f.n*.8,'most drops are away from home');
});

test('a burst sends the drops away from the press point, the near ones faster',()=>{
 const f=block();burstFrom(f,197,147,1200,seeded());
 let near=0,far=0,nn=0,nf=0;
 for(let i=0;i<f.n;i++){
  const dx=f.x[i]-197,dy=f.y[i]-147,d=Math.hypot(dx,dy),v=Math.hypot(f.vx[i],f.vy[i]);
  if(d>1)assert.ok((f.vx[i]*dx+f.vy[i]*dy)/d>0,'outward');
  if(d<15){near+=v;nn++;}else if(d>50){far+=v;nf++;}
  assert.ok(Math.abs(f.vx[i])<=1500&&Math.abs(f.vy[i])<=1500,'limited');
 }
 assert.ok(near/nn>far/nf,'faster near the press point');
 assert.equal(isCalm(f),false);f.vx.fill(0);f.vy.fill(0);assert.equal(isCalm(f),true);
});

test('a drip takes a drop of particles from the lowest edge',()=>{
 const f=block(),drop=dripIndices(f,2.3,seeded(7));
 assert.ok(drop.length>=3&&drop.length<40,`${drop.length} particles`);
 const lowest=Math.max(...f.ty);
 for(const i of drop)assert.ok(f.ty[i]>=lowest-6*2.3*2,'near the bottom');
 assert.deepEqual(dripIndices(new Fluid([],100,100,6),2),[]);
});

test('a settling phase blends extra parameters in and fades them out',()=>{
 const s=new Settle(),base={viscosity:.5,strength:1};
 s.start(1000,1000,{viscosity:.1,homing:3});
 const early=s.params(base,1100),late=s.params(base,1900),after=s.params(base,2100);
 const close=(a,b)=>Math.abs(a-b)<1e-12;
 assert.ok(close(early.viscosity,.1)&&close(early.homing,3),'fully blended in at first');assert.equal(early.strength,1);
 assert.ok(late.viscosity>.1&&late.viscosity<.5&&late.homing>1&&late.homing<3,'fading out');
 assert.equal(after,base,'over: the base itself');
});

test('the idle hand loops around the centre within its radii',()=>{
 const c={x:200,y:100,rx:80,ry:20};
 for(let s=0;s<30;s+=.7){const p=idleHand(c,s);assert.ok(Math.abs(p.x-200)<=80&&Math.abs(p.y-100)<=20);}
 assert.notDeepEqual(idleHand(c,0),idleHand(c,3));
});
