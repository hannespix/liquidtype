import {readFile,writeFile,mkdir,copyFile,cp,rm} from 'node:fs/promises';
// Main page modules, in dependency order for the inlined offline file.
const modules=['physics.mjs','render.mjs','glyphs.mjs','app.mjs'];
const files=['index.html','404.html','style.css',...modules];
await mkdir('dist',{recursive:true});
for(const file of files)await copyFile('src/'+file,'dist/'+file);
// Subpages are static folders that import the shared engine modules from ../
for(const folder of ['MS']){
 await rm('dist/'+folder,{recursive:true,force:true});
 await cp('src/'+folder,'dist/'+folder,{recursive:true});
}
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
console.log('Built dist/ (main page and MS/) and Liquid-Type-Offline.html (zero runtime dependencies).');
