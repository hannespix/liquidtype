import test from 'node:test';
import assert from 'node:assert/strict';
import {Upright,screenDirection,quarter,quarterToDown} from '../src/MS/sensors.mjs';

// A phone held upright (portrait, slightly leaning back) in the spec's frame,
// and the change of the reading when its right edge tips down.
const UPRIGHT={x:0,y:8.5},RIGHT_DOWN={x:-4.9,y:-1.3};
// How four kinds of device report a true reading.
const devices={
 spec:v=>v,
 'iOS (opposite signs)':v=>({x:-v.x,y:-v.y}),
 'axes turned one way':v=>({x:v.y,y:-v.x}),
 'axes turned the other way':v=>({x:-v.y,y:v.x}),
};
const learn=(u,v,angle=0,times=12)=>{for(let i=0;i<times;i++)u.add(v.x+(i%3-1)*.2,v.y,angle);return u.turn;};

for(const [name,report] of Object.entries(devices)){
 test(`${name}: tipping the right edge down lets the liquid run right`,()=>{
  const u=new Upright();
  assert.notEqual(learn(u,report(UPRIGHT)),null);
  const d=u.direction(report(RIGHT_DOWN).x,report(RIGHT_DOWN).y);
  assert.ok(d.x>4&&Math.abs(d.y)<2,JSON.stringify(d));
  // Moving the phone up leaves the liquid behind, down the screen.
  const up=report({x:0,y:6}),m=u.direction(up.x,up.y);
  assert.ok(m.y>5&&Math.abs(m.x)<.5,JSON.stringify(m));
 });
}

test('a spec device needs no correction, also in landscape',()=>{
 assert.equal(learn(new Upright(),UPRIGHT),0);
 // Turned counter-clockwise into landscape, "up" on the screen is the device's x.
 assert.equal(learn(new Upright(),{x:8.5,y:0},90),0);
 assert.equal(learn(new Upright(),{x:-8.5,y:0},270),0);
});

test('a phone lying flat or shaking teaches nothing',()=>{
 const flat=new Upright();
 for(let i=0;i<50;i++)flat.add(.3,.5);
 assert.equal(flat.turn,null);
 assert.deepEqual(flat.direction(-4,0),screenDirection(-4,0),'standard alignment until learned');
 const shaky=new Upright();
 for(let i=0;i<50;i++)shaky.add(i%2?6:-6,8);
 assert.equal(shaky.turn,null);
});

test('forgetting starts over, e.g. after the screen turned',()=>{
 const u=new Upright();learn(u,{x:0,y:-8.5});assert.equal(u.turn,2);
 u.forget();assert.equal(u.turn,null);
 assert.equal(learn(u,UPRIGHT),0);
});

test('quarter turns',()=>{
 assert.deepEqual(quarter({x:1,y:0},1),{x:-0,y:1});
 assert.deepEqual(quarter({x:1,y:2},4),{x:1,y:2});
 assert.equal(quarterToDown({x:-3,y:0}),3);
 assert.equal(quarterToDown({x:0,y:-3}),2);
});
