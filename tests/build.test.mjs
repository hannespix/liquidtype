import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('build emits a parseable fully offline document',async()=>{
 await import('../scripts/build.mjs');
 const html=fs.readFileSync('Liquid-Type-Offline.html','utf8');
 const js=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(!/^\s*(import |export )/m.test(js));
 for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(m[1].startsWith('#')||m[1].startsWith('data:'),m[1]);
 for(const name of ['index.html','style.css','app.mjs','physics.mjs','render.mjs'])assert.ok(fs.existsSync('dist/'+name));
});
