import ctypes as C,re
E=C.CDLL('libEGL.so.1')
def fn(name,restype,args):
 E.eglGetProcAddress.restype=C.c_void_p;E.eglGetProcAddress.argtypes=[C.c_char_p]
 p=E.eglGetProcAddress(name.encode())
 if not p: raise RuntimeError(name)
 return C.CFUNCTYPE(restype,*args)(p)
I=C.c_int;U=C.c_uint;P=C.c_void_p
get=fn('eglGetPlatformDisplayEXT',P,[U,P,C.POINTER(I)])
d=get(0x31dd,None,None)
init=fn('eglInitialize',U,[P,C.POINTER(I),C.POINTER(I)])
a,b=I(),I();assert init(d,C.byref(a),C.byref(b))
attrs=(I*13)(0x3024,8,0x3023,8,0x3022,8,0x3033,1,0x3040,0x40,0x3021,8,0x3038)
config=P();n=I();choose=fn('eglChooseConfig',U,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)]);assert choose(d,attrs,C.byref(config),1,C.byref(n)) and n.value
fn('eglBindAPI',U,[U])(0x30a0)
ctx=fn('eglCreateContext',P,[P,P,P,C.POINTER(I)])(d,config,None,(I*3)(0x3098,3,0x3038));assert ctx
surf=fn('eglCreatePbufferSurface',P,[P,P,C.POINTER(I)])(d,config,(I*5)(0x3057,32,0x3056,32,0x3038));assert surf
assert fn('eglMakeCurrent',U,[P,P,P,P])(d,surf,surf,ctx)
create=fn('glCreateShader',U,[U]);source=fn('glShaderSource',None,[U,I,C.POINTER(C.c_char_p),C.POINTER(I)]);compile_=fn('glCompileShader',None,[U]);getiv=fn('glGetShaderiv',None,[U,U,C.POINTER(I)]);log=fn('glGetShaderInfoLog',None,[U,I,C.POINTER(I),C.c_char_p]);program=fn('glCreateProgram',U,[]);attach=fn('glAttachShader',None,[U,U]);link=fn('glLinkProgram',None,[U]);getp=fn('glGetProgramiv',None,[U,U,C.POINTER(I)])
src=open('src/render.mjs').read(); shaders=dict(re.findall(r'const (\w+)=`(.*?)`;',src,re.S))
for pair in [('vertex','drop'),('screen','surface')]:
 p=program()
 for name,typ in zip(pair,[0x8b31,0x8b30]):
  s=create(typ);code=C.c_char_p(shaders[name].encode());source(s,1,C.byref(code),None);compile_(s);ok=I();getiv(s,0x8b81,C.byref(ok))
  if not ok.value:
   buf=C.create_string_buffer(4096);log(s,4096,None,buf);raise RuntimeError(buf.value.decode())
  attach(p,s)
 link(p);ok=I();getp(p,0x8b82,C.byref(ok));assert ok.value,pair
 print('Compiled and linked GLSL ES 3.0:',', '.join(pair))
