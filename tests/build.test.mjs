import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
await import('../scripts/build.mjs');
test('build emits a parseable fully offline document',()=>{
 const html=fs.readFileSync('Liquid-Type-Offline.html','utf8');
 const js=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(!/^\s*(import |export )/m.test(js));
 assert.ok(js.includes('function sampleGlyphs('),'shared glyph sampler is inlined');
 for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(m[1].startsWith('#')||m[1].startsWith('data:'),m[1]);
 for(const name of ['index.html','404.html','style.css','app.mjs','physics.mjs','render.mjs','glyphs.mjs'])assert.ok(fs.existsSync('dist/'+name),name);
});
test('MS subpage is built with its font and licence',()=>{
 for(const name of ['index.html','style.css','ms.mjs','fonts/playfair-display-700-latin.woff2','fonts/OFL.txt'])assert.ok(fs.existsSync('dist/MS/'+name),name);
 const html=fs.readFileSync('dist/MS/index.html','utf8');
 assert.match(html,/<meta name="robots" content="noindex">/);
 assert.match(html,/<link rel="canonical" href="https:\/\/matthiassuetterlin\.github\.io\/matthiassuetterlin-website\/">/);
});
test('every local reference in dist resolves to a built file',()=>{
 const files=fs.readdirSync('dist',{recursive:true}).map(f=>path.join('dist',f)).filter(f=>/\.(html|css|mjs)$/.test(f));
 for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const refs=[...text.matchAll(/(?:src|href)="([^"]+)"|url\("?([^")]+)"?\)|^import .*? from '([^']+)'/gm)].map(m=>m[1]||m[2]||m[3]);
  for(const ref of refs){
   if(/^(?:[a-z]+:|#|\/)/i.test(ref))continue;
   const target=path.join(path.dirname(file),ref.split(/[?#]/)[0]);
   assert.ok(fs.existsSync(target)&&(fs.statSync(target).isFile()||fs.existsSync(path.join(target,'index.html'))),`${file} -> ${ref}`);
  }
 }
});
