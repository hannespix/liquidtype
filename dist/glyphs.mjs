// Glyph sampling shared by every Liquid Type page.
// `draw(ctx)` paints the ink in CSS pixels; it is called twice: once on a 1x
// canvas whose coverage becomes the particle lattice, and once on a
// high-resolution canvas that the renderer uses as material texture.
export function sampleGlyphs(width,height,draw,budget){
 const c=document.createElement('canvas');c.width=Math.ceil(width);c.height=Math.ceil(height);
 const ctx=c.getContext('2d',{willReadFrequently:true});draw(ctx);
 // High-resolution glyph coverage is material data for the particles, never a
 // screen-space text image, SVG overlay, opacity layer or alternative renderer.
 const material=document.createElement('canvas');const scale=Math.min(devicePixelRatio||1,2);material.width=Math.ceil(width*scale);material.height=Math.ceil(height*scale);
 const mc=material.getContext('2d');mc.scale(material.width/width,material.height/height);draw(mc);
 const rgba=ctx.getImageData(0,0,c.width,c.height).data;
 let area=0;for(let i=3;i<rgba.length;i+=4)area+=rgba[i]/255;
 let spacing=Math.max(2.5,Math.sqrt(area/(budget*.8)));
 let points=[];
 // Keep a complete lattice cell for every ink intersection, including fine serifs.
 for(let attempt=0;attempt<3;attempt++){
  points=[];
  for(let y=0;y<height;y+=spacing)for(let x=0;x<width;x+=spacing){
   let ink=false;
   for(let yy=Math.floor(y);yy<Math.min(height,y+spacing)&&!ink;yy++)for(let xx=Math.floor(x);xx<Math.min(width,x+spacing);xx++){
    if(rgba[(yy*c.width+xx)*4+3]>0){ink=true;break;}
   }
   if(ink)points.push({x:x+spacing*.5,y:y+spacing*.5});
  }
  if(points.length<=budget)break;spacing*=Math.sqrt(points.length/budget)*1.03;
 }
 return {points,spacing,material};
}
