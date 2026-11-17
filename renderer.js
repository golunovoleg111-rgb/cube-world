import {SIZE,HEIGHT,BLOCKS} from './world.js';
const faces=[[[1,0,0],[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],.78],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],.68],[[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],1],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],.48],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],.85],[[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],.72]];
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL unavailable');this.gl=gl;this.chunks=new Map();this.quality=0;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec3 aColor;uniform vec3 uEye;uniform vec2 uAngle;uniform vec2 uProjection;varying vec3 vColor;varying vec3 vWorld;varying float vDistance;void main(){vec3 p=aPosition-uEye;float sy=sin(uAngle.x),cy=cos(uAngle.x),sp=sin(uAngle.y),cp=cos(uAngle.y);float x=cy*p.x-sy*p.z;float z=sy*p.x+cy*p.z;float y=cp*p.y-sp*z;z=sp*p.y+cp*z;gl_Position=vec4(x*uProjection.x,y*uProjection.y,-1.002*z-.2002,-z);vColor=aColor;vWorld=aPosition;vDistance=length(p);}`));
  gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 vColor;varying vec3 vWorld;varying float vDistance;uniform vec3 uSky;void main(){vec3 q=floor(vWorld*8.);float n=fract(sin(dot(q,vec3(12.9898,78.233,45.164)))*43758.5453);vec3 col=vColor*(.9+n*.16);float fog=smoothstep(30.,85.,vDistance);gl_FragColor=vec4(mix(col,uSky,fog),1.);}`));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  gl.useProgram(this.program);this.pos=gl.getAttribLocation(this.program,'aPosition');this.color=gl.getAttribLocation(this.program,'aColor');this.uniforms={};for(const n of ['uEye','uAngle','uProjection','uSky'])this.uniforms[n]=gl.getUniformLocation(this.program,n);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);this.special=gl.createBuffer();
 }
 build(world,cx,cz){
  const a=[];
  for(let x=cx*16;x<Math.min(SIZE,cx*16+16);x++)for(let z=cz*16;z<Math.min(SIZE,cz*16+16);z++)for(let y=0;y<HEIGHT;y++){
   const b=world.get(x,y,z);if(!b)continue;
   for(const [n,vertices,light] of faces){if(world.get(x+n[0],y+n[1],z+n[2]))continue;
    let col=BLOCKS[b].color;if(b===1&&n[1]===0)col=[.46,.4,.25];if(b===1&&n[1]<0)col=BLOCKS[2].color;
    for(const i of [0,1,2,0,2,3])a.push(x+vertices[i][0],y+vertices[i][1],z+vertices[i][2],...col.map(v=>v*light));
   }
  }
  const gl=this.gl,key=cx+','+cz;let chunk=this.chunks.get(key);if(!chunk)chunk={buffer:gl.createBuffer(),cx,cz};gl.bindBuffer(gl.ARRAY_BUFFER,chunk.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);chunk.count=a.length/6;this.chunks.set(key,chunk);
 }
 rebuild(world){for(let x=0;x<SIZE/16;x++)for(let z=0;z<SIZE/16;z++)this.build(world,x,z)}
 update(world,x,z){const keys=new Set();for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const cx=Math.floor((x+dx)/16),cz=Math.floor((z+dz)/16);if(cx>=0&&cz>=0&&cx<4&&cz<4)keys.add(cx+','+cz)}for(const key of keys)this.build(world,...key.split(',').map(Number))}
 bind(buffer){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(this.pos);gl.enableVertexAttribArray(this.color);gl.vertexAttribPointer(this.pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(this.color,3,gl.FLOAT,false,24,12)}
 render(eye,yaw,pitch,time,target){
  const gl=this.gl,c=this.canvas;const dpr=this.quality===1?1:Math.min(devicePixelRatio||1,1.75);const w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;gl.viewport(0,0,w,h)}
  const sky=[.59,.78,.82];gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniform3fv(this.uniforms.uEye,eye);gl.uniform2f(this.uniforms.uAngle,yaw,pitch);gl.uniform2f(this.uniforms.uProjection,1.35/(w/h),1.35);gl.uniform3fv(this.uniforms.uSky,sky);
  for(const chunk of this.chunks.values()){this.bind(chunk.buffer);gl.drawArrays(gl.TRIANGLES,0,chunk.count)}
  // A single low cost water surface surrounding the island.
  const a=[],water=[.27,.59,.65];for(const p of [[-200,4.8,-200],[-200,4.8,200],[200,4.8,200],[-200,4.8,-200],[200,4.8,200],[200,4.8,-200]])a.push(...p,...water);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.special);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.DYNAMIC_DRAW);this.bind(this.special);gl.drawArrays(gl.TRIANGLES,0,6);
  if(target){const lines=[],[x,y,z]=target.cell;for(const [n,vs] of faces)for(let i=0;i<4;i++)for(const v of [vs[i],vs[(i+1)%4]])lines.push(x+.5+(v[0]-.5)*1.006,y+.5+(v[1]-.5)*1.006,z+.5+(v[2]-.5)*1.006,1,.98,.78);gl.bindBuffer(gl.ARRAY_BUFFER,this.special);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.DYNAMIC_DRAW);this.bind(this.special);gl.drawArrays(gl.LINES,0,lines.length/6)}
 }
}
