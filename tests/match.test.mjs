import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPoints} from '../src/MS/match.mjs';
import {strokeWidth} from '../src/glyphs.mjs';

const grid=(x0,y0,cols,rows,step)=>{const out=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)out.push({x:x0+c*step,y:y0+r*step});return out;};

test('every target gets a partner, also with fewer sources than targets',()=>{
 const from=grid(0,0,10,10,5),to=grid(300,40,40,25,2);
 const pair=matchPoints(from,to);
 assert.equal(pair.length,to.length);
 for(const j of pair)assert.ok(j>=0&&j<from.length);
 const used=new Set(pair);assert.ok(used.size>from.length*.9,'nearly every source takes part');
});

test('neighbours stay neighbours, so a flight keeps the liquid together',()=>{
 // A compact block flows into alternating lines of two fonts (say project
 // names and their captions). The points come grouped by font, as sampling
 // delivers them, not in reading order.
 const from=grid(150,300,30,30,3),names=[],captions=[];
 for(let k=0;k<4;k++){names.push(...grid(20,60+k*24,100,3,2.5));captions.push(...grid(20,72+k*24,100,2,2.5));}
 const to=[...names,...captions];
 const index=new Map(to.map((p,i)=>[p.x+','+p.y,i]));
 const spread=pair=>{let sum=0,count=0;
  for(let i=0;i<to.length;i++){
   // Each point and the point straight below it (also across the fonts).
   for(let dy=2.5;dy<=7.5;dy+=2.5){const j=index.get(to[i].x+','+(to[i].y+dy));if(j===undefined)continue;
    const a=from[pair[i]],b=from[pair[j]];sum+=Math.hypot(a.x-b.x,a.y-b.y);count++;break;}
  }
  return sum/count;};
 const banded=spread(matchPoints(from,to));
 // Pairing in list order tears names and captions apart.
 const listOrder=spread(Int32Array.from(to,(_,i)=>Math.floor(i*from.length/to.length)));
 assert.ok(banded<6,`banded ${banded}`);
 assert.ok(listOrder>banded*4,`list order ${listOrder} vs banded ${banded}`);
});

test('empty sets pair to nothing',()=>{
 assert.equal(matchPoints([],grid(0,0,3,3,1)).length,9);
 assert.equal(matchPoints(grid(0,0,3,3,1),[]).length,0);
});

test('stroke width measures the weight of the ink',()=>{
 const W=60,H=60;
 const bar=width=>{const rgba=new Uint8ClampedArray(W*H*4);for(let y=10;y<50;y++)for(let x=20;x<20+width;x++)rgba[(y*W+x)*4+3]=255;return rgba;};
 const thin=strokeWidth(bar(2),W,H),bold=strokeWidth(bar(6),W,H);
 assert.ok(Math.abs(thin-2)<.3,`thin ${thin}`);
 assert.ok(Math.abs(bold-6)<1,`bold ${bold}`);
 assert.equal(strokeWidth(new Uint8ClampedArray(W*H*4),W,H),0);
});
