import {SIZE,HEIGHT,isOpaque} from './world.js?v=4';
import {atlasPixels} from './textures.js?v=4';
import {dayLight} from './survival.js?v=4';
const FACES=[[[1,0,0],[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],.79],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],.66],[[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],1],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],.48],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],.87],[[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],.72]];
const UV=[[0,0],[1,0],[1,1],[0,1]],TRI=[0,1,2,0,2,3];
function tileFor(b,ny){return b===1?(ny>0?0:ny<0?2:1):b===2?2:b===3?3:b===4?(ny?5:4):b===5?6:b===6?7:b===7?8:b===8?10:b===9?11:b===10?12:b===11?13:b===12?14:15;}
const TILES={14:16,15:17,16:17,17:18,18:19,19:20,20:21,21:23,22:24,23:26,24:27,25:28,26:29,27:30,28:31,29:32,30:33,31:17,32:17,33:34,34:35,35:36,36:47,37:40,38:41,39:42,40:43,41:44,42:45,43:46,44:20};
export function blockTile(b,ny){return b===20&&ny?22:b===22&&ny?25:TILES[b]??tileFor(b,ny);}
function box(array,center,size,tile,light=1){for(const [,vs,shade] of FACES)for(const i of TRI)array.push(center[0]+(vs[i][0]-.5)*size[0],center[1]+(vs[i][1]-.5)*size[1],center[2]+(vs[i][2]-.5)*size[2],...UV[i],tile,light*shade);}
export const VERTEX_SHADER=`
attribute vec3 aPosition;
attribute vec2 aUV;
attribute float aTile;
attribute float aLight;
uniform mediump vec3 uEye;
uniform vec3 uOffset;
uniform vec2 uAngle;
uniform vec2 uProjection;
varying mediump vec2 vUV;
varying mediump float vTile;
varying mediump float vLight;
varying mediump vec3 vWorld;
varying mediump float vDistance;
void main(){
 vec3 p=aPosition+uOffset-uEye;
 float sy=sin(uAngle.x),cy=cos(uAngle.x),sp=sin(uAngle.y),cp=cos(uAngle.y);
 float x=cy*p.x-sy*p.z;
 float depth=sy*p.x+cy*p.z;
 float y=cp*p.y+sp*depth;
 float z=-sp*p.y+cp*depth;
 gl_Position=vec4(x*uProjection.x,y*uProjection.y,-1.001*z-.2001,-z);
 vUV=aUV;vTile=aTile;vLight=aLight;vWorld=p;vDistance=length(p);
}`;
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
  if(!gl)throw Error('WebGL unavailable');this.gl=gl;this.chunks=new Map();this.settings={fov:75,scale:1.5,texture:32};this.epoch=0;this.pending=false;this.meshQueue=new Set();
  try{this.worker=new Worker(new URL('./terrain-worker.js?v=4',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{this.pending=false;if(data.epoch!==this.epoch||!data.chunk||!this.world?.infinite)return;this.world.accept(data.chunk);const {cx,cz}=data.chunk,key=cx+','+cz;if(data.mesh&&data.revision===this.world.revision){this.upload(cx,cz,data.mesh);this.meshQueue.delete(key);}else this.meshQueue.add(key);};this.worker.onerror=()=>{this.worker.terminate();this.worker=null;this.pending=false;};}catch{this.worker=null;}
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,VERTEX_SHADER));
  gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
precision mediump float;
uniform sampler2D uAtlas;
uniform float uTileSize;
uniform float uTime;
uniform int uMode;
uniform vec3 uSky;
uniform mediump vec3 uEye;
uniform float uDay;
uniform vec4 uLights[4];
uniform vec2 uWaterOffset;
uniform vec3 uTint;
uniform vec3 uSun;
uniform vec2 uSkyAngle;
uniform vec2 uSkyProj;
varying mediump vec2 vUV;
varying mediump float vTile;
varying mediump float vLight;
varying mediump vec3 vWorld;
varying mediump float vDistance;
float random(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(random(i),random(i+vec2(1.,0.)),f.x),mix(random(i+vec2(0.,1.)),random(i+1.),f.x),f.y);}
void main(){
 if(uMode==6){
  vec3 r=normalize(vec3(vWorld.x*uSkyProj.x/uSkyProj.y,vWorld.y/uSkyProj.y,-1.));
  float sy=sin(uSkyAngle.x),cy=cos(uSkyAngle.x),sp=sin(uSkyAngle.y),cp=cos(uSkyAngle.y);
  float ry=cp*r.y-sp*r.z,rz=sp*r.y+cp*r.z;
  vec3 direction=vec3(cy*r.x+sy*rz,ry,-sy*r.x+cy*rz);
  float horizon=pow(1.-max(0.,direction.y),4.),warm=pow(1.-abs(uSun.y),5.)*uDay;
  vec3 color=mix(uSky*vec3(.58,.72,1.),uSky+vec3(.22,.12,.03)*warm,horizon);
  float sunDot=max(0.,dot(direction,uSun)),moonDot=max(0.,dot(direction,-uSun));
  color+=vec3(1.,.77,.38)*(pow(sunDot,90.)*.35+smoothstep(.9992,.9997,sunDot));
  color+=vec3(.55,.65,.83)*smoothstep(.9995,.9998,moonDot)*(1.-uDay);
  if(direction.y>.035){vec2 p=direction.xz/direction.y*1.7+vec2(uTime*.008,0.);float clouds=smoothstep(.58,.76,cloudNoise(p)*.65+cloudNoise(p*2.)*.35);color=mix(color,vec3(.15+.8*uDay),clouds*.7*smoothstep(.03,.2,direction.y));vec2 star=floor(direction.xz/(direction.y+.2)*180.);float stars=step(.997,random(star));color+=stars*(1.-uDay)*smoothstep(.05,.4,direction.y)*.7;}
  gl_FragColor=vec4(color,1.);return;
 }
 if(uMode==2){gl_FragColor=vec4(1.,.95,.68,1.);return;}
 if(uMode==3){gl_FragColor=vec4(uTint,1.);return;}
 float tile=floor(vTile+.5);
 vec2 local=clamp(vUV,0.,1.);
 if(uMode==1){tile=9.;local=fract((vWorld.xz+uWaterOffset)*.45+vec2(uTime*.014,uTime*.009));}
 vec2 pixel=(floor(local*(uTileSize-1.))+.5)/uTileSize;
 vec2 uv=(vec2(mod(tile,8.),floor(tile/8.))+pixel)/8.;
 vec4 sampled=texture2D(uAtlas,uv);vec3 texel=sampled.rgb;
 float lamps=0.;for(int i=0;i<4;i++){float d=length(vWorld-uLights[i].xyz);lamps+=max(0.,1.-d/9.)*uLights[i].w;}
 float warmth=pow(1.-abs(uSun.y),4.)*uDay;
 vec3 light=vec3(.075,.1,.145)+vec3(1.+warmth*.25,1.-warmth*.1,1.-warmth*.3)*vLight*(.12+uDay*.76)+vec3(1.,.68,.31)*lamps*(1.+sin(uTime*11.)*.035);
 vec3 color=texel*light;
 float alpha=tile==16.?sampled.a:1.;
 if(uMode==1){float ripple=sin(vWorld.x*2.+uTime)*sin(vWorld.z*1.7-uTime*.7);color+=ripple*.035;alpha=.87;}
 if(tile==8.||tile==15.||tile==33.)color=max(color,texel*.8);
 float fog=smoothstep(34.,64.,length(vWorld));
 gl_FragColor=vec4(mix(color,uSky,fog),alpha);
}`));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.attributes=[['aPosition',3,0],['aUV',2,12],['aTile',1,20],['aLight',1,24]].map(([n,size,offset])=>({location:gl.getAttribLocation(this.program,n),size,offset}));
  this.uniforms={};for(const n of ['uEye','uAngle','uProjection','uSky','uMode','uTime','uAtlas','uTileSize','uOffset','uDay','uWaterOffset','uTint','uSun','uSkyAngle','uSkyProj'])this.uniforms[n]=gl.getUniformLocation(this.program,n);this.uniforms.uLights=gl.getUniformLocation(this.program,'uLights[0]');
  this.atlas=gl.createTexture();this.setTextures(32);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);this.outline=gl.createBuffer();this.water=gl.createBuffer();this.entities=gl.createBuffer();this.skyBuffer=gl.createBuffer();
  const water=[];for(const p of [[-150,0,-150],[-150,0,150],[150,0,150],[-150,0,-150],[150,0,150],[150,0,-150]])water.push(...p,0,0,9,1);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.water);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(water),gl.STATIC_DRAW);
 }
 setTextures(size){const gl=this.gl,{data,width}=atlasPixels(size);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,width,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.textureSize=size;}
 configure(settings){this.settings={...settings};if(this.textureSize!==settings.texture)this.setTextures(settings.texture);}
 upload(cx,cz,mesh){const gl=this.gl,key=cx+','+cz;let chunk=this.chunks.get(key);if(!chunk)chunk={buffer:gl.createBuffer(),glass:gl.createBuffer(),cx,cz};for(const [buffer,data] of [[chunk.buffer,mesh.opaque],[chunk.glass,mesh.glass]]){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);}chunk.count=mesh.opaque.length/7;chunk.glassCount=mesh.glass.length/7;chunk.lights=mesh.lights;this.chunks.set(key,chunk);}
 build(world,cx,cz){
  const a=[],glass=[],lights=[],height=world.height||HEIGHT,loaded=world.infinite?world.chunk(cx,cz):null;
  const get=(x,y,z)=>{if(y<0||y>=height)return 0;const lx=x-cx*16,lz=z-cz*16;return loaded&&lx>=0&&lx<16&&lz>=0&&lz<16?loaded.data[lx+16*(lz+16*y)]:(world.peek?world.peek(x,y,z):world.get(x,y,z));};
  const skyline=new Int16Array(256);for(let lx=0;lx<16;lx++)for(let lz=0;lz<16;lz++){for(let y=height-1;y>=0;y--)if(isOpaque(get(cx*16+lx,y,cz*16+lz))){skyline[lx+lz*16]=y;break;}}
  for(let x=cx*16;x<cx*16+16;x++)for(let z=cz*16;z<cz*16+16;z++)for(let y=0;y<height;y++){
   const b=get(x,y,z);if(!b)continue;
   if(b===13||b===7||b===30||b===18&&world.states?.[[x,y,z].join(',')]?.burn>0)lights.push([x+.5,y+.6,z+.5,b===7?.6:1]);
   if(b===13){box(a,[x-cx*16+.5,y+.35,z-cz*16+.5],[.15,.7,.15],15);continue;}
   const center=[x-cx*16+.5,y+.5,z-cz*16+.5],state=world.states?.[[x,y,z].join(',')]||{};
   if([15,16,31,32].includes(b)){let alongX=state.facing?.[0]!==0;if([31,32].includes(b))alongX=!alongX;box(a,center,alongX?[.13,1,1]:[1,1,.13],17);continue;}
   if(b===17){box(a,[center[0],y+.43,center[2]],[.9,.86,.9],18);continue;}
   if(b===19||b===44){box(a,[center[0],y+.24,center[2]],[1,.48,1],20);if(b===19)box(a,[center[0],y+.51,center[2]],[.8,.1,.42],12);continue;}
   if(b===30){box(a,[center[0],y+.4,center[2]],[.42,.65,.42],33);continue;}
   if(b===33){box(a,[center[0],y+.2,center[2]],[.06,.4,.06],6);box(a,[center[0],y+.45,center[2]],[.4,.1,.4],34);continue;}
   if(b===34){box(a,center,[.2,1,.2],35);box(a,[center[0],y+.7,center[2]],[1,.15,.15],35);box(a,[center[0],y+.3,center[2]],[1,.15,.15],35);continue;}
   const surface=skyline[x-cx*16+(z-cz*16)*16];
   const skylight=y<surface-2?.26:1;
   for(const [n,vs,light] of FACES){const neighbor=get(x+n[0],y+n[1],z+n[2]);if(isOpaque(neighbor)||(b===14&&neighbor===14))continue;const dest=b===14?glass:a;
    const tangents=[0,1,2].filter(k=>!n[k]);
    const shades=vs.map(v=>{const base=[x+n[0],y+n[1],z+n[2]],s1=[...base],s2=[...base],corner=[...base];s1[tangents[0]]+=v[tangents[0]]?1:-1;s2[tangents[1]]+=v[tangents[1]]?1:-1;corner[tangents[0]]=s1[tangents[0]];corner[tangents[1]]=s2[tangents[1]];return 1-(Number(isOpaque(get(...s1)))+Number(isOpaque(get(...s2)))+Number(isOpaque(get(...corner))))*.14;});
    for(const i of TRI){const v=vs[i];dest.push(x-cx*16+v[0],y+v[1],z-cz*16+v[2],...UV[i],b===18&&state.burn>0?48:blockTile(b,n[1]),light*skylight*shades[i]);}
   }
  }
  const gl=this.gl,key=cx+','+cz;let chunk=this.chunks.get(key);if(!chunk)chunk={buffer:gl.createBuffer(),glass:gl.createBuffer(),cx,cz};gl.bindBuffer(gl.ARRAY_BUFFER,chunk.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,chunk.glass);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(glass),gl.STATIC_DRAW);chunk.count=a.length/7;chunk.glassCount=glass.length/7;chunk.lights=lights;this.chunks.set(key,chunk);
 }
 rebuild(world,position=world.spawn){
  this.world=world;this.epoch++;
  for(const c of this.chunks.values()){this.gl.deleteBuffer(c.buffer);if(c.glass)this.gl.deleteBuffer(c.glass);}
  this.chunks.clear();this.meshQueue.clear();
  if(world.infinite){const cx=Math.floor(position[0]/16),cz=Math.floor(position[2]/16);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)world.chunk(cx+dx,cz+dz);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)this.build(world,cx+dx,cz+dz);}
  else for(let x=0;x<SIZE/16;x++)for(let z=0;z<SIZE/16;z++)this.build(world,x,z);
 }
 stream(world,position){
  if(!world.infinite)return;const cx=Math.floor(position[0]/16),cz=Math.floor(position[2]/16),needed=[];
  for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)needed.push([cx+dx,cz+dz,dx*dx+dz*dz]);needed.sort((a,b)=>a[2]-b[2]);
  for(const [key,c] of this.chunks)if(Math.abs(c.cx-cx)>3||Math.abs(c.cz-cz)>3){this.gl.deleteBuffer(c.buffer);if(c.glass)this.gl.deleteBuffer(c.glass);this.chunks.delete(key);}world.trim(cx,cz,5);
  const missing=needed.find(([x,z])=>!this.chunks.has(x+','+z)||this.meshQueue.has(x+','+z));
  for(const key of this.meshQueue){const [x,z]=key.split(',').map(Number);if(Math.abs(x-cx)>4||Math.abs(z-cz)>4)this.meshQueue.delete(key);}
  if(missing&&!this.pending){const [x,z]=missing;if(this.worker){this.pending=true;const states=Object.fromEntries(Object.entries(world.states||{}).filter(([key])=>{const [px,,pz]=key.split(',').map(Number);return Math.abs(Math.floor(px/16)-x)<=1&&Math.abs(Math.floor(pz/16)-z)<=1;}));this.worker.postMessage({seed:world.seed,cx:x,cz:z,epoch:this.epoch,generator:world.generator,revision:world.revision,edits:world.editsNear(x,z),states});}else{world.chunk(x,z);this.meshQueue.add(x+','+z);}}
  const next=needed.find(([x,z])=>world.chunks.has(x+','+z)&&(!this.chunks.has(x+','+z)||this.meshQueue.has(x+','+z)));
  if(next&&!this.worker){this.meshQueue.delete(next[0]+','+next[1]);this.build(world,next[0],next[1]);}
 }
 update(world,x,z){if(world.infinite)world.revision++;const keys=new Set();for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const cx=Math.floor((x+dx)/16),cz=Math.floor((z+dz)/16);if(world.infinite?this.chunks.has(cx+','+cz):cx>=0&&cz>=0&&cx<SIZE/16&&cz<SIZE/16)keys.add(cx+','+cz);}for(const key of keys){if(world.infinite&&this.worker)this.meshQueue.add(key);else this.build(world,...key.split(',').map(Number));}}
 bind(buffer){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const a of this.attributes){gl.enableVertexAttribArray(a.location);gl.vertexAttribPointer(a.location,a.size,gl.FLOAT,false,28,a.offset);}}
 render(eye,yaw,pitch,time,target,mobs=[],heldTorch=false,player=null){
  const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,2)*this.settings.scale;
  const w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;gl.viewport(0,0,w,h);}
  const lighting=dayLight(time),day=lighting.day,sky=[.035+.585*day,.055+.745*day,.12+.75*day];gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const sunAngle=lighting.phase*Math.PI*2,sun=[Math.cos(sunAngle),Math.sin(sunAngle),.4],sunLength=Math.hypot(...sun);gl.uniform3fv(this.uniforms.uSun,sun.map(v=>v/sunLength));
  gl.uniform3f(this.uniforms.uEye,0,0,0);gl.uniform2f(this.uniforms.uAngle,yaw,pitch);gl.uniform1f(this.uniforms.uDay,day);gl.uniform2f(this.uniforms.uWaterOffset,eye[0]%128,eye[2]%128);
  const lights=[...this.chunks.values()].flatMap(c=>c.lights||[]).filter(l=>Math.hypot(l[0]-eye[0],l[1]-eye[1],l[2]-eye[2])<12).sort((a,b)=>Math.hypot(a[0]-eye[0],a[2]-eye[2])-Math.hypot(b[0]-eye[0],b[2]-eye[2])).slice(0,heldTorch?3:4);
  if(heldTorch)lights.unshift([eye[0],eye[1]-.2,eye[2],1]);const packed=new Float32Array(16);lights.forEach((l,i)=>packed.set([l[0]-eye[0],l[1]-eye[1],l[2]-eye[2],l[3]],i*4));gl.uniform4fv(this.uniforms.uLights,packed);
  const projection=1/Math.tan(this.settings.fov*Math.PI/360);gl.uniform2f(this.uniforms.uProjection,projection/(w/h),projection);gl.uniform3fv(this.uniforms.uSky,sky);gl.uniform1f(this.uniforms.uTime,time);gl.uniform1f(this.uniforms.uTileSize,this.textureSize);gl.uniform1i(this.uniforms.uAtlas,0);gl.uniform1i(this.uniforms.uMode,0);
  const skyQuad=[];for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])skyQuad.push(x,y,-1,0,0,0,1);
  gl.uniform1i(this.uniforms.uMode,6);gl.uniform3f(this.uniforms.uOffset,0,0,0);gl.uniform2f(this.uniforms.uAngle,0,0);gl.uniform2f(this.uniforms.uProjection,1,1);gl.uniform2f(this.uniforms.uSkyAngle,yaw,pitch);gl.uniform2f(this.uniforms.uSkyProj,w/h,projection);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(skyQuad),gl.DYNAMIC_DRAW);this.bind(this.skyBuffer);gl.drawArrays(gl.TRIANGLES,0,6);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.uniform2f(this.uniforms.uAngle,yaw,pitch);gl.uniform2f(this.uniforms.uProjection,projection/(w/h),projection);gl.uniform1i(this.uniforms.uMode,0);
  for(const chunk of this.chunks.values()){gl.uniform3f(this.uniforms.uOffset,chunk.cx*16-eye[0],-eye[1],chunk.cz*16-eye[2]);this.bind(chunk.buffer);gl.drawArrays(gl.TRIANGLES,0,chunk.count);}
  // Nearby creatures share one mesh upload and one draw call.
  const animals=[];
  if(player?.thirdPerson){const p=player.position.map((v,i)=>v-eye[i]);box(animals,[p[0],p[1]+1.5,p[2]],[.5,.5,.5],37);box(animals,[p[0],p[1]+.95,p[2]],[.6,.65,.3],38);for(const sign of [-1,1]){box(animals,[p[0]+sign*.19,p[1]+.32,p[2]],[.24,.64,.27],39);box(animals,[p[0]+sign*.43,p[1]+.97,p[2]],[.2,.65,.25],37);}}
  for(const mob of mobs){const p=mob.position.map((v,i)=>v-eye[i]),walk=Math.sin(time*8+p[0])* .07;
   if(mob.type==='hostile'){
    box(animals,[p[0],p[1]+1.55,p[2]],[.46,.46,.46],6);
    box(animals,[p[0],p[1]+.97,p[2]],[.6,.72,.34],6);
    for(const sign of [-1,1]){box(animals,[p[0]+sign*.18,p[1]+.3,p[2]+sign*walk],[.22,.6,.25],14);box(animals,[p[0]+sign*.42,p[1]+.94,p[2]-.17],[.2,.62,.23],6);}
   }else{
    const tile=mob.type==='sheep'?12:4;
    box(animals,[p[0],p[1]+.65,p[2]],[.78,.65,1.05],tile);
    box(animals,[p[0],p[1]+.9,p[2]-.53],[.42,.4,.42],mob.type==='sheep'?3:5);
    for(const sign of [-1,1]){box(animals,[p[0]+sign*.11,p[1]+.97,p[2]-.75],[.07,.07,.03],14);if(mob.type==='deer'){box(animals,[p[0]+sign*.15,p[1]+1.28,p[2]-.5],[.06,.4,.06],5);box(animals,[p[0]+sign*.2,p[1]+1.4,p[2]-.5],[.18,.05,.06],5);}}
    for(const sx of [-1,1])for(const sz of [-1,1])box(animals,[p[0]+sx*.25,p[1]+.22,p[2]+sz*.32+sx*sz*walk],[.15,.44,.15],4);
   }
  }
  gl.uniform3f(this.uniforms.uOffset,0,0,0);if(animals.length){gl.bindBuffer(gl.ARRAY_BUFFER,this.entities);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(animals),gl.DYNAMIC_DRAW);this.bind(this.entities);gl.drawArrays(gl.TRIANGLES,0,animals.length/7);}
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  for(const chunk of [...this.chunks.values()].sort((a,b)=>Math.hypot(b.cx*16-eye[0],b.cz*16-eye[2])-Math.hypot(a.cx*16-eye[0],a.cz*16-eye[2])))if(chunk.glassCount){gl.uniform3f(this.uniforms.uOffset,chunk.cx*16-eye[0],-eye[1],chunk.cz*16-eye[2]);this.bind(chunk.glass);gl.drawArrays(gl.TRIANGLES,0,chunk.glassCount);}
  gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  gl.uniform3f(this.uniforms.uOffset,0,(this.world?.seaLevel??4.8)-eye[1],0);gl.uniform1i(this.uniforms.uMode,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.depthMask(false);this.bind(this.water);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  gl.uniform3f(this.uniforms.uOffset,0,0,0);
  if(target){const lines=[],[x,y,z]=target.cell;for(const [,vs] of FACES)for(let i=0;i<4;i++)for(const v of [vs[i],vs[(i+1)%4]])lines.push(x-eye[0]+.5+(v[0]-.5)*1.006,y-eye[1]+.5+(v[1]-.5)*1.006,z-eye[2]+.5+(v[2]-.5)*1.006,0,0,0,1);gl.uniform1i(this.uniforms.uMode,2);gl.bindBuffer(gl.ARRAY_BUFFER,this.outline);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.DYNAMIC_DRAW);this.bind(this.outline);gl.drawArrays(gl.LINES,0,lines.length/7);}
  if(player&&!player.thirdPerson){const hand=[],swing=Math.sin((player.swing||0)*Math.PI),bob=player.moving?Math.sin(time*11)*.012:0;box(hand,[.42-swing*.12,-.37+bob+swing*.06,-.72-swing*.1],[.17,.48,.19],37);if(player.item)box(hand,[.36-swing*.13,-.2+bob,-.92],[.2,.2,.2],blockTile(player.item,1));gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniform2f(this.uniforms.uAngle,0,0);gl.uniform3f(this.uniforms.uOffset,0,0,0);gl.uniform1i(this.uniforms.uMode,0);gl.bindBuffer(gl.ARRAY_BUFFER,this.entities);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(hand),gl.DYNAMIC_DRAW);this.bind(this.entities);gl.drawArrays(gl.TRIANGLES,0,hand.length/7);}
 }
}
