import {SIZE,HEIGHT} from './world.js?v=2';
import {atlasPixels} from './textures.js?v=2';
const FACES=[[[1,0,0],[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],.79],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],.66],[[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],1],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],.48],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],.87],[[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],.72]];
const UV=[[0,0],[1,0],[1,1],[0,1]],TRI=[0,1,2,0,2,3];
function tileFor(b,ny){return b===1?(ny>0?0:ny<0?2:1):b===2?2:b===3?3:b===4?(ny?5:4):b===5?6:b===6?7:b===7?8:b===8?10:11;}
export const VERTEX_SHADER=`
attribute vec3 aPosition;
attribute vec2 aUV;
attribute float aTile;
attribute float aLight;
uniform vec3 uEye;
uniform vec2 uAngle;
uniform vec2 uProjection;
varying vec2 vUV;
varying float vTile;
varying float vLight;
varying vec3 vWorld;
varying float vDistance;
void main(){
 vec3 p=aPosition-uEye;
 float sy=sin(uAngle.x),cy=cos(uAngle.x),sp=sin(uAngle.y),cp=cos(uAngle.y);
 float x=cy*p.x-sy*p.z;
 float depth=sy*p.x+cy*p.z;
 float y=cp*p.y+sp*depth;
 float z=-sp*p.y+cp*depth;
 gl_Position=vec4(x*uProjection.x,y*uProjection.y,-1.001*z-.2001,-z);
 vUV=aUV;vTile=aTile;vLight=aLight;vWorld=aPosition;vDistance=length(p);
}`;
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
  if(!gl)throw Error('WebGL unavailable');this.gl=gl;this.chunks=new Map();this.settings={fov:75,scale:1.25,texture:16};
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,VERTEX_SHADER));
  gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
precision mediump float;
uniform sampler2D uAtlas;
uniform float uTileSize;
uniform float uTime;
uniform int uMode;
uniform vec3 uSky;
uniform vec3 uEye;
varying vec2 vUV;
varying float vTile;
varying float vLight;
varying vec3 vWorld;
varying float vDistance;
void main(){
 if(uMode==2){gl_FragColor=vec4(1.,.95,.68,1.);return;}
 float tile=floor(vTile+.5);
 vec2 local=clamp(vUV,0.,1.);
 if(uMode==1){tile=9.;local=fract(vWorld.xz*.45+vec2(uTime*.014,uTime*.009));}
 vec2 pixel=(floor(local*(uTileSize-1.))+.5)/uTileSize;
 vec2 uv=(vec2(mod(tile,4.),floor(tile/4.))+pixel)/4.;
 vec3 color=texture2D(uAtlas,uv).rgb*vLight;
 float alpha=1.;
 if(uMode==1){float ripple=sin(vWorld.x*2.+uTime)*sin(vWorld.z*1.7-uTime*.7);color+=ripple*.035;alpha=.87;}
 if(tile==8.)color*=1.12;
 float fog=smoothstep(40.,130.,length(vWorld-uEye));
 gl_FragColor=vec4(mix(color,uSky,fog),alpha);
}`));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.attributes=[['aPosition',3,0],['aUV',2,12],['aTile',1,20],['aLight',1,24]].map(([n,size,offset])=>({location:gl.getAttribLocation(this.program,n),size,offset}));
  this.uniforms={};for(const n of ['uEye','uAngle','uProjection','uSky','uMode','uTime','uAtlas','uTileSize'])this.uniforms[n]=gl.getUniformLocation(this.program,n);
  this.atlas=gl.createTexture();this.setTextures(16);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);this.outline=gl.createBuffer();this.water=gl.createBuffer();
  const water=[];for(const p of [[-200,4.8,-200],[-200,4.8,200],[200,4.8,200],[-200,4.8,-200],[200,4.8,200],[200,4.8,-200]])water.push(...p,0,0,9,1);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.water);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(water),gl.STATIC_DRAW);
 }
 setTextures(size){const gl=this.gl,{data,width}=atlasPixels(size);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,width,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.textureSize=size;}
 configure(settings){this.settings={...settings};if(this.textureSize!==settings.texture)this.setTextures(settings.texture);}
 build(world,cx,cz){
  const a=[];
  for(let x=cx*16;x<Math.min(SIZE,cx*16+16);x++)for(let z=cz*16;z<Math.min(SIZE,cz*16+16);z++)for(let y=0;y<HEIGHT;y++){
   const b=world.get(x,y,z);if(!b)continue;
   for(const [n,vs,light] of FACES){if(world.get(x+n[0],y+n[1],z+n[2]))continue;for(const i of TRI)a.push(x+vs[i][0],y+vs[i][1],z+vs[i][2],...UV[i],tileFor(b,n[1]),light);}
  }
  const gl=this.gl,key=cx+','+cz;let chunk=this.chunks.get(key);if(!chunk)chunk={buffer:gl.createBuffer()};gl.bindBuffer(gl.ARRAY_BUFFER,chunk.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);chunk.count=a.length/7;this.chunks.set(key,chunk);
 }
 rebuild(world){for(let x=0;x<SIZE/16;x++)for(let z=0;z<SIZE/16;z++)this.build(world,x,z);}
 update(world,x,z){const keys=new Set();for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const cx=Math.floor((x+dx)/16),cz=Math.floor((z+dz)/16);if(cx>=0&&cz>=0&&cx<SIZE/16&&cz<SIZE/16)keys.add(cx+','+cz);}for(const key of keys)this.build(world,...key.split(',').map(Number));}
 bind(buffer){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const a of this.attributes){gl.enableVertexAttribArray(a.location);gl.vertexAttribPointer(a.location,a.size,gl.FLOAT,false,28,a.offset);}}
 render(eye,yaw,pitch,time,target){
  const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,2)*this.settings.scale;
  const w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;gl.viewport(0,0,w,h);}
  const sky=[.62,.8,.87];gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  gl.uniform3fv(this.uniforms.uEye,eye);gl.uniform2f(this.uniforms.uAngle,yaw,pitch);
  const projection=1/Math.tan(this.settings.fov*Math.PI/360);gl.uniform2f(this.uniforms.uProjection,projection/(w/h),projection);gl.uniform3fv(this.uniforms.uSky,sky);gl.uniform1f(this.uniforms.uTime,time);gl.uniform1f(this.uniforms.uTileSize,this.textureSize);gl.uniform1i(this.uniforms.uAtlas,0);gl.uniform1i(this.uniforms.uMode,0);
  for(const chunk of this.chunks.values()){this.bind(chunk.buffer);gl.drawArrays(gl.TRIANGLES,0,chunk.count);}
  gl.uniform1i(this.uniforms.uMode,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.depthMask(false);this.bind(this.water);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  if(target){const lines=[],[x,y,z]=target.cell;for(const [,vs] of FACES)for(let i=0;i<4;i++)for(const v of [vs[i],vs[(i+1)%4]])lines.push(x+.5+(v[0]-.5)*1.006,y+.5+(v[1]-.5)*1.006,z+.5+(v[2]-.5)*1.006,0,0,0,1);gl.uniform1i(this.uniforms.uMode,2);gl.bindBuffer(gl.ARRAY_BUFFER,this.outline);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.DYNAMIC_DRAW);this.bind(this.outline);gl.drawArrays(gl.LINES,0,lines.length/7);}
 }
}
