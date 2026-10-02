import test from 'node:test';
import assert from 'node:assert/strict';
import {Fluid} from '../src/physics.mjs';
import {curveParameter,sagWeight,restrain} from '../src/MS/coupling.mjs';
test('curve parameter inverts the Bézier x for any anchor',()=>{
 for(const anchor of [0,.2,.5,.8,1])for(const x of [0,10,250,499,800,1000]){
  const t=curveParameter(1000,anchor,x),a=1000*anchor;
  const back=2*(1-t)*t*a+t*t*1000;
  assert.ok(Math.abs(back-x)<1e-6,`anchor ${anchor} x ${x}`);
 }
 assert.equal(sagWeight(1000,.5,500),1);assert.equal(sagWeight(1000,.5,0),0);assert.equal(sagWeight(1000,.5,1000),0);
});
test('a line pushes liquid above itself, lifts it with its own speed and counts the load',()=>{
 const f=new Fluid([{x:500,y:100},{x:500,y:180},{x:100,y:180}],1000,400,6);
 f.vy[1]=50;
 // Line at rest height 200, pulled up by 40 px in the middle: peak at y=160.
 const {load,impact}=restrain(f,{top:200,width:1000,anchor:.5,offset:-40,rate:-300});
 assert.equal(load,1);assert.ok(Math.abs(impact-350)<1e-6,'approach speed relative to the rising line, full weight at the peak');
 assert.equal(f.y[0],100);assert.equal(f.vy[0],0);
 assert.equal(f.y[1],160);assert.ok(f.vy[1]<=-300,'carried upward with the line');
 assert.ok(Math.abs(f.y[2]-180)<1e-9,'near the ends the line hardly moves');
});
test('liquid dragged below a resting line pools on it and keeps flowing sideways',()=>{
 const f=new Fluid([{x:400,y:150}],1000,400,6);
 f.y[0]=260;f.vx[0]=120;f.vy[0]=400;
 const {load,impact}=restrain(f,{top:200,width:1000,anchor:.5,offset:0,rate:0});
 assert.equal(load,1);assert.ok(impact>300&&impact<400,'a falling drop hits with its speed, scaled by where it lands');assert.equal(f.y[0],200);assert.equal(f.vx[0],120);assert.ok(f.vy[0]<0&&f.vy[0]>-100,'gentle rebound');
});
