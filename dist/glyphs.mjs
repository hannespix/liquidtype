// Glyph sampling shared by every Liquid Type page.

// One particle per lattice cell that holds ink above `threshold` (alpha 0-255).
// `rgba` covers the rectangle starting at (ox,oy) with a row width of `stride`.
// With `centre`, only the pixel under the cell's centre counts: the cells
// then cover the same area as the ink instead of a rim of one cell around it.
function latticeScan(rgba,stride,ox,oy,x0,y0,x1,y1,spacing,threshold,centre=false){
 const points=[];
 for(let y=y0;y<y1;y+=spacing)for(let x=x0;x<x1;x+=spacing){
  if(centre){
   const cx=Math.min(x1-1,Math.floor(x+spacing*.5)),cy=Math.min(y1-1,Math.floor(y+spacing*.5));
   if(rgba[((cy-oy)*stride+(cx-ox))*4+3]>threshold)points.push({x:x+spacing*.5,y:y+spacing*.5});
   continue;
  }
  let ink=false;
  for(let yy=Math.floor(y);yy<Math.min(y1,y+spacing)&&!ink;yy++)for(let xx=Math.floor(x);xx<Math.min(x1,x+spacing);xx++){
   if(rgba[((yy-oy)*stride+(xx-ox))*4+3]>threshold){ink=true;break;}
  }
  if(ink)points.push({x:x+spacing*.5,y:y+spacing*.5});
 }
 return points;
}
// High-resolution coverage used by the renderer as material texture.
export function glyphMaterial(width,height,draw){
 const material=document.createElement('canvas');const scale=Math.min(devicePixelRatio||1,2);material.width=Math.ceil(width*scale);material.height=Math.ceil(height*scale);
 const mc=material.getContext('2d');mc.scale(material.width/width,material.height/height);draw(mc);
 return material;
}
// Mean stroke width of the ink in px: twice its area over its outline length.
// Thin and light type measures less than bold or large type.
export function strokeWidth(rgba,stride,rows){
 let area=0,edge=0;
 for(let y=0;y<rows;y++)for(let x=0;x<stride;x++){
  const k=(y*stride+x)*4+3,a=rgba[k]/255;area+=a;
  const right=x+1<stride?rgba[k+4]/255:0,below=y+1<rows?rgba[k+stride*4]/255:0;
  const ex=right-a,ey=below-a;edge+=Math.sqrt(ex*ex+ey*ey);
 }
 return edge>0?2*area/edge:0;
}
// Ink painted by `draw`, read back only inside `box` {x0,y0,x1,y1} (or the
// whole area). One scratch canvas is reused; only the box is cleared. The
// result can be scanned at several spacings without painting again; its
// stroke width is measured once, when first asked for.
let latticeCanvas=null;
export function glyphRaster(width,height,draw,{box=null}={}){
 const cw=Math.ceil(width),ch=Math.ceil(height);
 const x0=Math.max(0,Math.floor(box?box.x0:0)),y0=Math.max(0,Math.floor(box?box.y0:0));
 const x1=Math.min(width,Math.ceil(box?box.x1:width)),y1=Math.min(height,Math.ceil(box?box.y1:height));
 if(x1<=x0||y1<=y0)return {rgba:null,x0,y0,x1:x0,y1:y0,stroke:0};
 if(!latticeCanvas||latticeCanvas.width<cw||latticeCanvas.height<ch){latticeCanvas=document.createElement('canvas');latticeCanvas.width=cw;latticeCanvas.height=ch;}
 const ctx=latticeCanvas.getContext('2d',{willReadFrequently:true});
 ctx.clearRect(x0,y0,x1-x0,y1-y0);ctx.save();draw(ctx);ctx.restore();
 const rgba=ctx.getImageData(x0,y0,x1-x0,y1-y0).data;
 let stroke=null;
 return {rgba,x0,y0,x1,y1,get stroke(){return stroke??=strokeWidth(rgba,x1-x0,y1-y0);}};
}
// Particles on a fixed lattice over a raster. `spacing` is a number or a
// function of the ink's stroke width, so the lattice can follow the weight of
// the type. With `faithful`, a lattice no coarser than the strokes takes
// cells by their centre, so the particles carry the type's own weight (every
// stroke still crosses a cell centre). Returns the points, the spacing used
// and the stroke width.
export function rasterLattice(raster,spacing,{threshold=0,faithful=false}={}){
 const {rgba,x0,y0,x1,y1}=raster;
 const stroke=typeof spacing==='number'&&!faithful?0:raster.stroke;
 const s=typeof spacing==='number'?spacing:spacing(stroke);
 if(!rgba)return {points:[],spacing:s,stroke};
 return {points:latticeScan(rgba,x1-x0,x0,y0,x0,y0,x1,y1,s,threshold,faithful&&s<=stroke),spacing:s,stroke};
}
// Both steps at once, for a single spacing.
export function glyphLattice(width,height,draw,spacing,{box=null,threshold=0,faithful=false}={}){
 return rasterLattice(glyphRaster(width,height,draw,{box}),spacing,{threshold,faithful});
}
// `draw(ctx)` paints the ink in CSS pixels; it is called twice: once on a 1x
// canvas whose coverage becomes the particle lattice, and once on a
// high-resolution canvas that the renderer uses as material texture.
export function sampleGlyphs(width,height,draw,budget){
 const c=document.createElement('canvas');c.width=Math.ceil(width);c.height=Math.ceil(height);
 const ctx=c.getContext('2d',{willReadFrequently:true});draw(ctx);
 // High-resolution glyph coverage is material data for the particles, never a
 // screen-space text image, SVG overlay, opacity layer or alternative renderer.
 const material=glyphMaterial(width,height,draw);
 const rgba=ctx.getImageData(0,0,c.width,c.height).data;
 let area=0;for(let i=3;i<rgba.length;i+=4)area+=rgba[i]/255;
 let spacing=Math.max(2.5,Math.sqrt(area/(budget*.8)));
 let points=[];
 // Keep a complete lattice cell for every ink intersection, including fine serifs.
 for(let attempt=0;attempt<3;attempt++){
  points=latticeScan(rgba,c.width,0,0,0,0,width,height,spacing,0);
  if(points.length<=budget)break;spacing*=Math.sqrt(points.length/budget)*1.03;
 }
 return {points,spacing,material};
}
