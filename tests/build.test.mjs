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
 // Everything the page loads is inlined; plain links may lead to the live site.
 for(const m of html.matchAll(/<(?:script|img|link|source|iframe)\b[^>]*?(?:src|href)="([^"]+)"/g))assert.ok(m[1].startsWith('data:'),m[1]);
 for(const m of html.matchAll(/<a\b[^>]*?href="([^"]+)"/g))assert.ok(m[1].startsWith('#')||m[1].startsWith('https://hannespix.github.io/liquidtype/'),m[1]);
 assert.ok(html.includes('href="https://hannespix.github.io/liquidtype/impressum/"'),'the offline file links the live imprint');
 for(const name of ['index.html','404.html','style.css','app.mjs','physics.mjs','render.mjs','glyphs.mjs','quality.mjs','sensors.mjs','cursor.mjs','effects.mjs'])assert.ok(fs.existsSync('dist/'+name),name);
});
test('the offline document declares every top-level name once',()=>{
 // All modules share one scope there; a second function of the same name
 // would silently replace the first instead of failing.
 const js=fs.readFileSync('Liquid-Type-Offline.html','utf8').match(/<script>\n([\s\S]*?)<\/script>/)[1];
 const names=[...js.matchAll(/^(?:async )?(?:function\*? |class |const |let )([\w$]+)/gm)].map(m=>m[1]);
 const twice=names.filter((n,i)=>names.indexOf(n)!==i);
 assert.deepEqual(twice,[]);
 assert.ok(names.includes('LiquidCursor')&&names.includes('MotionReader')&&names.includes('burstFrom'),'shared effect modules are inlined');
});
test('the imprint is built, linked from the main page and credits Matthias Sütterlin',()=>{
 const html=fs.readFileSync('dist/impressum/index.html','utf8');
 assert.match(html,/<h1>Impressum<\/h1>/);
 assert.match(html,/Angaben gemäß § 5 DDG/);
 assert.match(html,/Hannes Pix<br>Eisenbahnstraße 19<br>79241 Ihringen am Kaiserstuhl/);
 assert.match(html,/nach Inspiration von Matthias Sütterlin entstanden und basiert teilweise auf seinen Ideen/);
 assert.match(html,/href="https:\/\/github\.com\/matthiassuetterlin"/);
 assert.match(fs.readFileSync('dist/index.html','utf8'),/href="\.\/impressum\/"/);
});
test('MS subpage is built with its font and licence',()=>{
 for(const name of ['index.html','style.css','ms.mjs','fonts/playfair-display-700-latin.woff2','fonts/OFL.txt'])assert.ok(fs.existsSync('dist/MS/'+name),name);
 const html=fs.readFileSync('dist/MS/index.html','utf8');
 assert.match(html,/<meta name="robots" content="noindex">/);
 assert.match(html,/<link rel="canonical" href="https:\/\/matthiassuetterlin\.github\.io\/matthiassuetterlin-website\/">/);
});
test('dist references carry one shared version stamp',()=>{
 const stamps=new Set();
 for(const file of ['dist/index.html','dist/app.mjs','dist/MS/index.html','dist/MS/ms.mjs']){
  const refs=[...fs.readFileSync(file,'utf8').matchAll(/["'](\.\.?\/[\w./-]+\.(?:mjs|css))(\?v=[0-9a-f]{8})?["']/g)];
  assert.ok(refs.length>0,file);
  for(const m of refs){assert.ok(m[2],`${file}: ${m[1]} is not stamped`);stamps.add(m[2]);}
 }
 assert.equal(stamps.size,1);
 assert.ok(!/\?v=/.test(fs.readFileSync('Liquid-Type-Offline.html','utf8')));
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
