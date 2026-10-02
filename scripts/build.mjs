import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const files=['index.html','style.css','physics.mjs','render.mjs','app.mjs'];
await mkdir('dist',{recursive:true});
for(const file of files)await copyFile('src/'+file,'dist/'+file);
let html=await readFile('src/index.html','utf8');
const css=await readFile('src/style.css','utf8');
const parts=[];
for(const name of ['physics.mjs','render.mjs','app.mjs']){
 let js=await readFile('src/'+name,'utf8');
 js=js.replace(/^import .*?;\s*/gm,'').replace(/^export (?=class )/gm,'');parts.push(js);
}
const script='(()=>{\n"use strict";\n'+parts.join('\n')+'\n})();\n';
if(/<\/script/i.test(script)||/<\/style/i.test(css))throw new Error('Unsafe inline closing tag');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>\n'+css+'\n</style>');
html=html.replace('<script type="module" src="./app.mjs"></script>',()=>'<script>\n'+script+'</script>');
await writeFile('Liquid-Type-Offline.html',html);
console.log('Built dist/ and Liquid-Type-Offline.html (zero runtime dependencies).');
