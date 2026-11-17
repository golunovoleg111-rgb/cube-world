import {SIZE,HEIGHT} from './world.js?v=3';
import {atlasPixels} from './textures.js?v=3';
import {dayLight} from './survival.js?v=3';
const FACES=[[[1,0,0],[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],.79],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],.66],[[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],1],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],.48],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],.87],[[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],.72]];
const UV=[[0,0],[1,0],[1,1],[0,1]],TRI=[0,1,2,0,2,3];
function tileFor(b,ny){return b===1?(ny>0?0:ny<0?2:1):b===2?2:b===3?3:b===4?(ny?5:4):b===5?6:b===6?7:b===7?8:b===8?10:b===9?11:b===10?12:b===11?13:b===12?14:15;}
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
  try{this.worker=new Worker(new URL('./terrain-worker.js?v=3',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{this.pending=false;if(data.epoch!==this.epoch||!data.chunk||!this.world?.infinite)return;this.world.accept(data.chunk);const {cx,cz}=data.chunk;for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])if(this.world.chunks.has((cx+dx)+','+(cz+dz)))this.meshQueue.add((cx+dx)+','+(cz+dz));};this.worker.onerror=()=>{this.worker.terminate();this.worker=null;this.pending=false;};}catch{this.worker=null;}
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
varying mediump vec2 vUV;
varying mediump float vTile;
varying mediump float vLight;
varying mediump vec3 vWorld;
varying mediump float vDistance;
void main(){
 if(uMode==2){gl_FragColor=vec4(1.,.95,.68,1.);return;}
 if(uMode==3){gl_FragColor=vec4(uTint,1.);return;}
 float tile=floor(vTile+.5);
 vec2 local=clamp(vUV,0.,1.);
 if(uMode==1){tile=9.;local=fract((vWorld.xz+uWaterOffset)*.45+vec2(uTime*.014,uTime*.009));}
 vec2 pixel=(floor(local*(uTileSize-1.))+.5)/uTileSize;
 vec2 uv=(vec2(mod(tile,4.),floor(tile/4.))+pixel)/4.;
 vec3 texel=texture2D(uAtlas,uv).rgb;
 float lamps=0.;for(int i=0;i<4;i++){float d=length(vWorld-uLights[i].xyz);lamps+=max(0.,1.-d/9.)*uLights[i].w;}
 vec3 light=vec3(.12+vLight*(.14+uDay*.74))+vec3(1.,.68,.31)*lamps;
 vec3 color=texel*light;
 float alpha=1.;
 if(uMode==1){float ripple=sin(vWorld.x*2.+uTime)*sin(vWorld.z*1.7-uTime*.7);color+=ripple*.035;alpha=.87;}
 if(tile==8.||tile==15.)color=max(color,texel*.8);
 float fog=smoothstep(34.,64.,length(vWorld));
 gl_FragColor=vec4(mix(color,uSky,fog),alpha);
}`));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.attributes=[['aPosition',3,0],['aUV',2,12],['aTile',1,20],['aLight',1,24]].map(([n,size,offset])=>({location:gl.getAttribLocation(this.program,n),size,offset}));
  this.uniforms={};for(const n of ['uEye','uAngle','uProjection','uSky','uMode','uTime','uAtlas','uTileSize','uOffset','uDay','uWaterOffset','uTint'])this.uniforms[n]=gl.getUniformLocation(this.program,n);this.uniforms.uLights=gl.getUniformLocation(this.program,'uLights[0]');
  this.atlas=gl.createTexture();this.setTextures(32);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);this.outline=gl.createBuffer();this.water=gl.createBuffer();this.entities=gl.createBuffer();this.skyBuffer=gl.createBuffer();
  const water=[];for(const p of [[-150,0,-150],[-150,0,150],[150,0,150],[-150,0,-150],[150,0,150],[150,0,-150]])water.push(...p,0,0,9,1);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.water);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(water),gl.STATIC_DRAW);
 }
 setTextures(size){const gl=this.gl,{data,width}=atlasPixels(size);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,width,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.textureSize=size;}
 configure(settings){this.settings={...settings};if(this.textureSize!==settings.texture)this.setTextures(settings.texture);}
 build(world,cx,cz){
  const a=[],lights=[],height=world.height||HEIGHT,loaded=world.infinite?world.chunk(cx,cz):null;
  const get=(x,y,z)=>{if(y<0||y>=height)return 0;const lx=x-cx*16,lz=z-cz*16;return loaded&&lx>=0&&lx<16&&lz>=0&&lz<16?loaded.data[lx+16*(lz+16*y)]:(world.peek?world.peek(x,y,z):world.get(x,y,z));};
  for(let x=cx*16;x<cx*16+16;x++)for(let z=cz*16;z<cz*16+16;z++)for(let y=0;y<height;y++){
   const b=get(x,y,z);if(!b)continue;
   if(b===13||b===7)lights.push([x+.5,y+.6,z+.5,b===13?1:.6]);
   if(b===13){box(a,[x-cx*16+.5,y+.35,z-cz*16+.5],[.15,.7,.15],15);continue;}
   const surface=loaded?loaded.columns[x-cx*16+(z-cz*16)*16].height:height;
   const skylight=world.infinite&&y<surface-2?.18:1;
   for(const [n,vs,light] of FACES){const neighbor=get(x+n[0],y+n[1],z+n[2]);if(neighbor&&neighbor!==13)continue;const shade=n[1]===0&&get(x,y+1,z)?.85:1;for(const i of TRI)a.push(x-cx*16+vs[i][0],y+vs[i][1],z-cz*16+vs[i][2],...UV[i],tileFor(b,n[1]),light*skylight*shade);}
  }
  const gl=this.gl,key=cx+','+cz;let chunk=this.chunks.get(key);if(!chunk)chunk={buffer:gl.createBuffer(),cx,cz};gl.bindBuffer(gl.ARRAY_BUFFER,chunk.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);chunk.count=a.length/7;chunk.lights=lights;this.chunks.set(key,chunk);
 }
 rebuild(world,position=world.spawn){this.world=world;this.epoch++;for(const c of this.chunks.values())this.gl.deleteBuffer(c.buffer);this.chunks.clear();this.meshQueue.clear();if(world.infinite){const cx=Math.floor(position[0]/16),cz=Math.floor(position[2]/16);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)world.chunk(cx+dx,cz+dz);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)this.build(world,cx+dx,cz+dz);}else for(let x=0;x<SIZE/16;x++)for(let z=0;z<SIZE/16;z++)this.build(world,x,z);}
 stream(world,position){
  if(!world.infinite)return;const cx=Math.floor(position[0]/16),cz=Math.floor(position[2]/16),needed=[];
  for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)needed.push([cx+dx,cz+dz,dx*dx+dz*dz]);needed.sort((a,b)=>a[2]-b[2]);
  for(const [key,c] of this.chunks)if(Math.abs(c.cx-cx)>3||Math.abs(c.cz-cz)>3){this.gl.deleteBuffer(c.buffer);this.chunks.delete(key);}world.trim(cx,cz,5);
  const missing=needed.find(([x,z])=>!world.chunks.has(x+','+z));
  for(const key of this.meshQueue){const [x,z]=key.split(',').map(Number);if(Math.abs(x-cx)>4||Math.abs(z-cz)>4)this.meshQueue.delete(key);}
  if(missing&&!this.pending){const [x,z]=missing;if(this.worker){this.pending=true;this.worker.postMessage({seed:world.seed,cx:x,cz:z,epoch:this.epoch});}else{world.chunk(x,z);this.meshQueue.add(x+','+z);}}
  const next=needed.find(([x,z])=>world.chunks.has(x+','+z)&&(!this.chunks.has(x+','+z)||this.meshQueue.has(x+','+z)));
  if(next){this.meshQueue.delete(next[0]+','+next[1]);this.build(world,next[0],next[1]);}
 }
 update(world,x,z){const keys=new Set();for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const cx=Math.floor((x+dx)/16),cz=Math.floor((z+dz)/16);if(world.infinite?this.chunks.has(cx+','+cz):cx>=0&&cz>=0&&cx<SIZE/16&&cz<SIZE/16)keys.add(cx+','+cz);}for(const key of keys)this.build(world,...key.split(',').map(Number));}
 bind(buffer){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const a of this.attributes){gl.enableVertexAttribArray(a.location);gl.vertexAttribPointer(a.location,a.size,gl.FLOAT,false,28,a.offset);}}
 render(eye,yaw,pitch,time,target,mobs=[],heldTorch=false){
  const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,2)*this.settings.scale;
  const w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;gl.viewport(0,0,w,h);}
  const lighting=dayLight(time),day=lighting.day,sky=[.035+.585*day,.055+.745*day,.12+.75*day];gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  gl.uniform3f(this.uniforms.uEye,0,0,0);gl.uniform2f(this.uniforms.uAngle,yaw,pitch);gl.uniform1f(this.uniforms.uDay,day);gl.uniform2f(this.uniforms.uWaterOffset,eye[0]%128,eye[2]%128);
  const lights=[...this.chunks.values()].flatMap(c=>c.lights||[]).filter(l=>Math.hypot(l[0]-eye[0],l[1]-eye[1],l[2]-eye[2])<12).sort((a,b)=>Math.hypot(a[0]-eye[0],a[2]-eye[2])-Math.hypot(b[0]-eye[0],b[2]-eye[2])).slice(0,heldTorch?3:4);
  if(heldTorch)lights.unshift([eye[0],eye[1]-.2,eye[2],1]);const packed=new Float32Array(16);lights.forEach((l,i)=>packed.set([l[0]-eye[0],l[1]-eye[1],l[2]-eye[2],l[3]],i*4));gl.uniform4fv(this.uniforms.uLights,packed);
  const projection=1/Math.tan(this.settings.fov*Math.PI/360);gl.uniform2f(this.uniforms.uProjection,projection/(w/h),projection);gl.uniform3fv(this.uniforms.uSky,sky);gl.uniform1f(this.uniforms.uTime,time);gl.uniform1f(this.uniforms.uTileSize,this.textureSize);gl.uniform1i(this.uniforms.uAtlas,0);gl.uniform1i(this.uniforms.uMode,0);
  for(const chunk of this.chunks.values()){gl.uniform3f(this.uniforms.uOffset,chunk.cx*16-eye[0],-eye[1],chunk.cz*16-eye[2]);this.bind(chunk.buffer);gl.drawArrays(gl.TRIANGLES,0,chunk.count);}
  // Nearby creatures share one mesh upload and one draw call.
  const animals=[];
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
  gl.uniform3f(this.uniforms.uOffset,0,(this.world?.seaLevel??4.8)-eye[1],0);gl.uniform1i(this.uniforms.uMode,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.depthMask(false);this.bind(this.water);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  gl.uniform3f(this.uniforms.uOffset,0,0,0);
  // Celestial cubes are camera-relative, keeping precision at distant coordinates.
  const celestial=[],angle=lighting.phase*Math.PI*2;
  box(celestial,[Math.cos(angle)*70,Math.sin(angle)*70,35],[5,5,5],12);
  box(celestial,[-Math.cos(angle)*70,-Math.sin(angle)*70,-35],[3,3,3],12);
  gl.uniform1i(this.uniforms.uMode,3);gl.uniform3f(this.uniforms.uTint,1,.91,.68);gl.depthMask(false);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(celestial),gl.DYNAMIC_DRAW);this.bind(this.skyBuffer);gl.drawArrays(gl.TRIANGLES,0,celestial.length/7);gl.depthMask(true);
  if(target){const lines=[],[x,y,z]=target.cell;for(const [,vs] of FACES)for(let i=0;i<4;i++)for(const v of [vs[i],vs[(i+1)%4]])lines.push(x-eye[0]+.5+(v[0]-.5)*1.006,y-eye[1]+.5+(v[1]-.5)*1.006,z-eye[2]+.5+(v[2]-.5)*1.006,0,0,0,1);gl.uniform1i(this.uniforms.uMode,2);gl.bindBuffer(gl.ARRAY_BUFFER,this.outline);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.DYNAMIC_DRAW);this.bind(this.outline);gl.drawArrays(gl.LINES,0,lines.length/7);}
 }
}
