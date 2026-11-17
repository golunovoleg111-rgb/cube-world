export const SIZE=64, HEIGHT=28;
export const BLOCKS=[null,{name:'Дёрн',color:[.43,.66,.28]},{name:'Земля',color:[.48,.33,.22]},{name:'Камень',color:[.53,.57,.56]},{name:'Дерево',color:[.49,.32,.17]},{name:'Листва',color:[.27,.53,.28]},{name:'Песок',color:[.82,.77,.54]},{name:'Кристалл',color:[.36,.9,.87]},{name:'Доски',color:[.7,.51,.29]},{name:'Кирпич',color:[.61,.35,.27]}];
export const index=(x,y,z)=>x+SIZE*(z+SIZE*y);
export function createWorld(seed){
 const data=new Uint8Array(SIZE*SIZE*HEIGHT);let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const get=(x,y,z)=>x<0||x>=SIZE||z<0||z>=SIZE||y<0||y>=HEIGHT?0:data[index(x,y,z)];
 const set=(x,y,z,b)=>{if(x>=0&&x<SIZE&&z>=0&&z<SIZE&&y>=0&&y<HEIGHT)data[index(x,y,z)]=b};
 const levels=new Uint8Array(SIZE*SIZE);const phase=random()*50;
 for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++){
  const d=Math.hypot((x-32)/32,(z-32)/32);
  const h=Math.max(1,Math.min(16,Math.floor(9+Math.sin(x*.15+phase)*2+Math.cos(z*.18)*2+Math.sin((x+z)*.11)*1.5-Math.max(0,d-.55)*15)));
  levels[x+z*SIZE]=h;
  for(let y=0;y<=h;y++)set(x,y,z,y===h?(h<=5?6:1):y>h-3?2:3);
 }
 for(let x=4;x<60;x++)for(let z=4;z<60;z++){
  const h=levels[x+z*SIZE];if(h<7||Math.hypot(x-32,z-32)<5||random()>.018)continue;
  const trunk=3+Math.floor(random()*2);
  for(let y=h+1;y<=h+trunk;y++)set(x,y,z,4);
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<=2;dy++)if(Math.abs(dx)+Math.abs(dz)+dy<5&&!get(x+dx,h+trunk+dy,z+dz))set(x+dx,h+trunk+dy,z+dz,5);
 }
 // Landmarks spread around the walkable interior; crystals are never inside trees.
 const crystals=[];
 for(const [x,z] of [[17,19],[45,17],[49,40],[22,48],[10,35]]){
  let y=HEIGHT-1;while(y>0&&!get(x,y,z))y--;
  set(x,y+1,z,7);crystals.push([x,y+1,z]);
 }
 return {data,get,set,seed,crystals,spawn:[32.5,levels[32+32*SIZE]+2,32.5]};
}
export function overlaps(world,p){
 if(p.some(v=>!Number.isFinite(v))||Math.abs(p[1])>1000)return true;
 for(let x=Math.floor(p[0]-.28);x<=Math.floor(p[0]+.28);x++)for(let z=Math.floor(p[2]-.28);z<=Math.floor(p[2]+.28);z++)for(let y=Math.floor(p[1]);y<=Math.floor(p[1]+1.65);y++)if(world.get(x,y,z))return true;
 return p[0]<.3||p[0]>SIZE-.3||p[2]<.3||p[2]>SIZE-.3;
}
// Exact voxel traversal: the adjacent placement cell always shares the hit face.
export function cast(world,origin,dir,reach=6){
 const length=Math.hypot(...dir);if(!length)return null;
 const ray=dir.map(v=>v/length),cell=origin.map(Math.floor),step=ray.map(Math.sign);
 const delta=ray.map(v=>v===0?Infinity:Math.abs(1/v));
 const next=ray.map((v,i)=>v===0?Infinity:((v>0?cell[i]+1:cell[i])-origin[i])/v);
 let previous=[...cell],distance=0;
 while(distance<=reach){
  if(world.get(...cell))return {cell:[...cell],previous,distance};
  const axis=next[0]<=next[1]&&next[0]<=next[2]?0:next[1]<=next[2]?1:2;
  previous=[...cell];distance=next[axis];next[axis]+=delta[axis];cell[axis]+=step[axis];
 }
 return null;
}
export function restoreSave(raw){
 const s=JSON.parse(raw);
 if(s.version!==1||!Number.isInteger(s.seed)||!Array.isArray(s.edits)||s.edits.length>SIZE*SIZE*HEIGHT||!Array.isArray(s.position)||s.position.length!==3||s.position.some(v=>!Number.isFinite(v))||!Number.isFinite(s.yaw)||!Number.isFinite(s.pitch))throw Error('Invalid save');
 for(const e of s.edits)if(!Array.isArray(e)||e.length!==4||e.some(v=>!Number.isInteger(v))||e[0]<0||e[0]>=SIZE||e[1]<1||e[1]>=HEIGHT||e[2]<0||e[2]>=SIZE||e[3]<0||e[3]>6)throw Error('Invalid edit');
 if(!Array.isArray(s.found)||s.found.some(v=>!Number.isInteger(v)||v<0||v>4))throw Error('Invalid progress');
 return s;
}
