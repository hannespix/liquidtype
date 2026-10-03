const vertex=`#version 300 es
precision highp float;
in vec2 position;
in vec2 home;
in float deformation;
in float size;
uniform vec2 resolution;
uniform float pointScale;
uniform float maxPoint;
uniform vec3 fine;
out vec2 materialHome;
out vec2 currentPosition;
out float strain;
out float dropRadius;
out float amplitude;
// fine = (size up to which a drop counts as fine, size from which it counts
// as coarse, reach growth in motion). A fine drop in motion reaches further
// with a weaker field, so it stays a thin line yet joins its neighbours
// into connected liquid instead of separate dots. Coarse drops are untouched.
uniform float fineAmp;
void main(){
 materialHome=home;currentPosition=position;strain=deformation;
 // The fine look holds until a drop is nearly home, so settling type never
 // swells: by the time the reach returns, the crisp material look leads.
 float f=1.-smoothstep(fine.x,fine.y,size),moving=smoothstep(.02,.3,deformation);
 float grow=mix(1.,fine.z,f*moving);
 dropRadius=size*2.1*grow;amplitude=mix(1.,fineAmp,f*moving);
 gl_Position=vec4(position/resolution*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);gl_PointSize=min(maxPoint,size*pointScale*grow);
}`;
const drop=`#version 300 es
precision highp float;
uniform sampler2D glyphMaterial;
uniform vec2 resolution;
in vec2 materialHome;
in vec2 currentPosition;
uniform vec2 pixelScale;
uniform float shrink;
in float strain;
in float dropRadius;
in float amplitude;
out vec4 color;
void main(){
 vec2 pixel=vec2(gl_FragCoord.x/pixelScale.x,resolution.y-gl_FragCoord.y/pixelScale.y);
 vec2 offset=pixel-currentPosition;
 // A drop in motion may draw smaller than at rest (shrink < 1), so moving
 // liquid stays fine instead of swelling into thick clumps.
 float shape=smoothstep(.02,.9,strain);
 vec2 q=offset/(dropRadius*mix(1.,shrink,shape));float d=dot(q,q);if(d>1.)discard;
 // Smooth, overlapping material kernels: there are no rectangular cells or
 // hard support edges. Normalize their coverage in the surface reconstruction.
 float ink=texture(glyphMaterial,(materialHome+offset)/resolution).a;
 float kernel=.16*amplitude*pow(max(0.,1.-d),3.);
 color=vec4(kernel*mix(ink,1.,shape),kernel,kernel*shape,0.);

}`;
const screen=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const surface=`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D density;
uniform vec2 texel;
uniform vec3 paper;
uniform vec3 ink;
out vec4 color;
void main(){
 vec3 sums=texture(density,uv).rgb;
 float coverage=sums.g;
 float agitation=clamp(sums.b/max(coverage,.0001),0.,1.);
 // At equilibrium the material samples agree exactly. During deformation the
 // same field becomes a free fluid-density surface; there is no second image.
 float v=.9*sums.r/max(mix(coverage,.16,agitation),.0001);
 v*=smoothstep(.006,.024,coverage);
 float aa=max(fwidth(v)*.65,.012);
 float body=smoothstep(.51-aa,.51+aa,v);
 color=vec4(mix(paper,ink,body),1.);

}`;
export class FluidRenderer {
 // Colours are linear 0..1 RGB triples; the defaults match the main Liquid Type page.
 // dropShrink (0..1) scales drops that are in motion; 1 keeps them full size.
 // fine = {from,to,grow,amp}: drops smaller than `from` (fading out by `to`)
 // reach `grow` times further in motion with a field of strength `amp`;
 // grow 1 and amp 1 leave every drop as designed.
 // calm (0..1) ignores a drop's leftover speed for its look, e.g. at the end
 // of a page transition; 0 leaves motion visible.
 // maxScale caps the drawing resolution in device pixels per CSS pixel; a
 // weak graphics chip draws far fewer pixels at 1 than at the usual 2.
 constructor(canvas,{paper=[.973,.973,.957],ink=[.016,.020,.019],dropShrink=1,fine={from:0,to:0,grow:1,amp:1},calm=0,maxScale=2}={}){
  this.paper=paper;this.ink=ink;this.dropShrink=dropShrink;this.fine=fine;this.calm=calm;this.maxScale=maxScale;
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance',depth:false,stencil:false});
  if(!gl)throw new Error('WebGL2 ist auf diesem Gerät nicht verfügbar.');
  this.gl=gl;this.canvas=canvas;this.floatSurface=!!gl.getExtension('EXT_color_buffer_float');
  this.points=this.program(vertex,drop);this.surface=this.program(screen,surface);
  // Uniform locations are looked up once instead of on every frame.
  const where=(program,names)=>Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(program,n)]));
  this.at=where(this.points,['resolution','pointScale','maxPoint','glyphMaterial','pixelScale','shrink','fine','fineAmp']);
  this.surfaceAt=where(this.surface,['density','texel','paper','ink']);
  this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,size,offset] of [['position',2,0],['home',2,8],['deformation',1,16],['size',1,20]]){const loc=gl.getAttribLocation(this.points,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,24,offset);}
  this.glyph=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.glyph);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.fbo=gl.createFramebuffer();this.data=new Float32Array(0);
  this.maxPointSize=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
 }
 setColors(paper,ink){this.paper=paper;this.ink=ink;}
 program(vs,fs){
  const gl=this.gl;const p=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
 }
 setMaterial(source){
  const gl=this.gl;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.glyph);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.activeTexture(gl.TEXTURE0);
 }
 resize(w,h){
  const gl=this.gl;this.w=w;this.h=h;this.scale=Math.min(devicePixelRatio||1,this.maxScale,2,2400/w);this.canvas.width=Math.round(w*this.scale);this.canvas.height=Math.round(h*this.scale);
  gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,this.floatSurface?gl.RGBA16F:gl.RGBA8,this.canvas.width,this.canvas.height,0,gl.RGBA,this.floatSurface?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);
  // The completeness check stalls the graphics pipeline, so only the first
  // surface is checked; later ones only change size, not format.
  if(!this.checked){if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Die Grafikoberfläche konnte nicht angelegt werden.');this.checked=true;}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 // dropSpacing sets the drawn drop size, or fluid.dropSize sets it per
 // particle (a Float32Array); the physics keeps fluid.spacing either way.
 draw(fluid,dropSpacing=fluid.spacing){
  const gl=this.gl;if(gl.isContextLost())return;
  if(this.data.length!==fluid.n*6)this.data=new Float32Array(fluid.n*6);
  const sizes=fluid.dropSize,stir=1-Math.max(0,Math.min(1,this.calm));
  for(let i=0;i<fluid.n;i++){
   const k=i*6;this.data[k]=fluid.x[i];this.data[k+1]=fluid.y[i];this.data[k+2]=fluid.tx[i];this.data[k+3]=fluid.ty[i];
   // Deformation is measured against the drop's own size, so a large drop
   // near home already looks at rest while a fine one still flows. calm
   // quiets leftover jitter and sub-pixel offsets; a drop still clearly away
   // from home keeps its liquid look, so it never draws the type shifted.
   const size=sizes?sizes[i]:dropSpacing,unit=sizes?Math.max(fluid.spacing,size):fluid.spacing;
   const dx=fluid.x[i]-fluid.tx[i],dy=fluid.y[i]-fluid.ty[i],vx=fluid.vx[i],vy=fluid.vy[i];
   this.data[k+4]=Math.sqrt(dx*dx+dy*dy)/(unit*(3-2*stir))+Math.sqrt(vx*vx+vy*vy)/(unit*12)*stir;
   this.data[k+5]=size;
  }
  gl.viewport(0,0,this.canvas.width,this.canvas.height);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(this.points);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data,gl.DYNAMIC_DRAW);
  const at=this.at;
  gl.uniform2f(at.resolution,this.w,this.h);gl.uniform1f(at.pointScale,4.2*this.scale);gl.uniform1f(at.maxPoint,this.maxPointSize);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.glyph);gl.uniform1i(at.glyphMaterial,1);gl.uniform2f(at.pixelScale,this.canvas.width/this.w,this.canvas.height/this.h);gl.uniform1f(at.shrink,this.dropShrink);gl.uniform3f(at.fine,this.fine.from,Math.max(this.fine.to,this.fine.from+.001),this.fine.grow);gl.uniform1f(at.fineAmp,this.fine.amp);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.drawArrays(gl.POINTS,0,fluid.n);gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(this.surface);gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  const sat=this.surfaceAt;
  gl.uniform1i(sat.density,0);gl.uniform2f(sat.texel,1/this.canvas.width,1/this.canvas.height);gl.uniform3fv(sat.paper,this.paper);gl.uniform3fv(sat.ink,this.ink);gl.drawArrays(gl.TRIANGLES,0,3);
 }
}

