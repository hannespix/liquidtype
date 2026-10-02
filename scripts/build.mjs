import {readFile,writeFile,mkdir,copyFile,cp,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
// Main page modules, in dependency order for the inlined offline file.
const modules=['physics.mjs','render.mjs','glyphs.mjs','app.mjs'];
const files=['index.html','404.html','style.css',...modules];
// Subpages are static folders that import the shared engine modules from ../
const folders=['MS'];

async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);out.push(...entry.isDirectory()?await walk(p):[p]);}return out.sort();}
// One version stamp per build, derived from every source file. Appended to
// local script and stylesheet references in dist/ so a deploy never mixes a
// fresh page with modules an HTTP cache kept from the previous version.
const digest=createHash('sha256');
for(const file of await walk('src'))digest.update(file+'\0').update(await readFile(file));
const version=digest.digest('hex').slice(0,8);
const stamp=text=>text.replace(/(["'])(\.\.?\/[\w./-]+\.(?:mjs|css))\1/g,(m,quote,ref)=>`${quote}${ref}?v=${version}${quote}`);

await mkdir('dist',{recursive:true});
for(const file of files)await copyFile('src/'+file,'dist/'+file);
for(const folder of folders){
 await rm('dist/'+folder,{recursive:true,force:true});
 await cp('src/'+folder,'dist/'+folder,{recursive:true});
}
for(const file of await walk('dist'))if(/\.(html|mjs)$/.test(file))await writeFile(file,stamp(await readFile(file,'utf8')));

let html=await readFile('src/index.html','utf8');
const css=await readFile('src/style.css','utf8');
const parts=[];
for(const name of modules){
 let js=await readFile('src/'+name,'utf8');
 js=js.replace(/^import .*?;\s*/gm,'').replace(/^export (?=(?:class|function) )/gm,'');parts.push(js);
}
const script='(()=>{\n"use strict";\n'+parts.join('\n')+'\n})();\n';
if(/<\/script/i.test(script)||/<\/style/i.test(css))throw new Error('Unsafe inline closing tag');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>\n'+css+'\n</style>');
html=html.replace('<script type="module" src="./app.mjs"></script>',()=>'<script>\n'+script+'</script>');
await writeFile('Liquid-Type-Offline.html',html);
console.log(`Built dist/ (main page and ${folders.join(', ')}, version ${version}) and Liquid-Type-Offline.html (zero runtime dependencies).`);
