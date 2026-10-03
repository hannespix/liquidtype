import test from 'node:test';
import assert from 'node:assert/strict';
import {DropChain} from '../src/MS/cursor.mjs';

const R=24,step=1/60;
const run=(chain,frames,move=null,near=null)=>{for(let i=0;i<frames;i++){if(move)move(i);chain.advance(step,near,R);}};

test('the chain follows the pointer and comes to rest on it',()=>{
 const c=new DropChain();
 run(c,30,i=>c.point(100+i*12,200));
 const head=c.drops[0],tail=c.drops[c.drops.length-1];
 assert.ok(head.x>tail.x,'the tail lags behind while moving');
 run(c,240);
 for(const d of c.drops)assert.ok(Math.abs(d.x-448)<1&&Math.abs(d.y-200)<1,`${d.x},${d.y}`);
});

test('moving swells the drop, resting lets it shrink slowly',()=>{
 const c=new DropChain();
 run(c,20,i=>c.point(100+i*30,100));
 const moving=c.size(0,R);
 assert.ok(moving>R*.8,`moving ${moving}`);
 run(c,60);
 const soon=c.size(0,R);
 run(c,600);
 const later=c.size(0,R);
 assert.ok(soon<moving&&later<soon,`${moving} → ${soon} → ${later}`);
 assert.ok(later>=R*c.o.rest*.99,'never below the resting size while the pointer is there');
 c.leave();run(c,200);
 assert.ok(c.size(0,R)<.1,'leaving fades it out');
});

test('near a letter a drop melts in, bridging to it; away it drains again',()=>{
 // A letter as a box from x 300 to 400.
 const near=(x,y)=>{const nx=Math.min(400,Math.max(300,x)),ny=Math.min(300,Math.max(100,y));return {d:Math.hypot(x-nx,y-ny),x:nx,y:ny};};
 const c=new DropChain();
 // The chain trails the pointer, so it comes to rest just outside the letter.
 run(c,20,i=>c.point(60+i*12,200),near);
 run(c,30,()=>c.point(296,200),near);
 const inside=c.shape(R);
 assert.ok(inside.solid.length>=3,'melting drop plus two bridge drops');
 const lead=inside.solid[0],bridge=inside.solid[1];
 assert.ok(bridge.x>lead.x||bridge.x===lead.x,'the bridge reaches toward the letter');
 const outlined=inside.outline.reduce((a,d)=>a+d.r,0);
 run(c,30,()=>c.point(330,200),near);
 const deeper=c.shape(R);
 assert.ok(deeper.outline.reduce((a,d)=>a+d.r,0)<outlined,'the outline draws in as it melts');
 run(c,120,i=>c.point(60,200),near);
 const away=c.shape(R);
 assert.equal(away.solid.length,0,'away from the letters nothing stays melted');
});

test('without letters nothing melts',()=>{
 const c=new DropChain();
 run(c,40,i=>c.point(300+i,200),null);
 assert.equal(c.shape(R).solid.length,0);
 assert.ok(c.shape(R).outline.length>0);
});

test('a resting drop stops changing, so its loop can sleep until the next move',()=>{
 const c=new DropChain();
 run(c,20,i=>c.point(100+i*20,100));
 assert.equal(c.advance(step,null,R),true,'moving');
 let frames=0;while(c.advance(step,null,R)&&frames<3000)frames++;
 assert.ok(frames<1200,`rests after ${frames} frames`);
 const resting=c.size(0,R);
 assert.ok(resting<R*.07,`shrunk to about the resting size: ${resting}`);
 c.point(160,100);
 assert.equal(c.advance(step,null,R),true,'a move wakes it');
});
