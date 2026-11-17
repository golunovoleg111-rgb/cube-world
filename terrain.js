// Coordinate-based generation: a chunk is identical regardless of load order.
export const CHUNK=16, WORLD_HEIGHT=96, SEA_LEVEL=28;
export const BIOMES={plains:'Луга',forest:'Лес',desert:'Пустыня',mountains:'Снежные горы',canyon:'Каньоны'};
export function hash(x,y,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,2147483647)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
const lerp=(a,b,t)=>a+(b-a)*t,fade=t=>t*t*(3-2*t);
export function noise2(x,z,seed){const ix=Math.floor(x),iz=Math.floor(z),fx=fade(x-ix),fz=fade(z-iz);return lerp(lerp(hash(ix,0,iz,seed),hash(ix+1,0,iz,seed),fx),lerp(hash(ix,0,iz+1,seed),hash(ix+1,0,iz+1,seed),fx),fz);}
export function noise3(x,y,z,seed){const iy=Math.floor(y),fy=fade(y-iy);return lerp(noise2(x+iy*13.37,z-iy*7.13,seed),noise2(x+(iy+1)*13.37,z-(iy+1)*7.13,seed),fy);}
function fbm(x,z,seed){return noise2(x,z,seed)*.57+noise2(x*2,z*2,seed+31)*.28+noise2(x*4,z*4,seed+89)*.15;}
export function columnAt(x,z,seed){
 const continent=fbm(x/280,z/280,seed+13),heat=noise2(x/150,z/150,seed+991),dry=noise2(x/125,z/125,seed+283);
 const detail=fbm(x/44,z/44,seed+114),ridge=1-Math.abs(noise2(x/100,z/100,seed+713)*2-1);
 let biome=heat<.28?'mountains':dry>.62?(heat>.56?'canyon':'desert'):dry<.4?'forest':'plains';
 let height=17+continent*34+(detail-.5)*9;
 if(biome==='mountains')height+=ridge*26;
 if(biome==='desert')height+=(noise2(x/23,z/23,seed+4)-.5)*7;
 const canyon=biome==='canyon'?Math.max(0,1-Math.abs(noise2(x/72,z/72,seed+899)-.5)/.1):0;
 if(biome==='canyon')height=42+Math.floor(detail*6)*3-canyon*29;
 height=Math.max(8,Math.min(83,Math.floor(height)));
 const top=height<=SEA_LEVEL+1||biome==='desert'?6:biome==='canyon'?11:biome==='mountains'&&height>48?10:1;
 return {height,biome,top,canyon};
}
export function caveAt(x,y,z,height,seed){
 if(y<3||y>height)return false;
 if(y>height-12&&noise2(x/21,z/21,seed+5107)>.88)return true;
 if(y>height-3)return false;
 const chamber=noise3(x/19,y/14,z/19,seed+701);
 const tunnel=Math.abs(noise3(x/27,y/21,z/27,seed+1701)-.5);
 return chamber>.73||(tunnel<.044&&noise3(x/45,y/24,z/45,seed+1901)>.48);
}
const at=(x,y,z)=>x+16*(z+16*y);
export function generateChunk(seed,cx,cz){
 const data=new Uint8Array(CHUNK*CHUNK*WORLD_HEIGHT),columns=[];
 for(let lx=0;lx<16;lx++)for(let lz=0;lz<16;lz++){
  const x=cx*16+lx,z=cz*16+lz,c=columnAt(x,z,seed);columns[lx+lz*16]=c;
  for(let y=0;y<=c.height;y++){
   if(caveAt(x,y,z,c.height,seed))continue;
   let b=y===c.height?c.top:y>c.height-4?(c.top===6?6:c.top===11?11:2):3;
   if(y<c.height-5&&y>2){const ore=hash(x,y,z,seed+887);if(ore>.987)b=12;if(ore>.9997&&y<26)b=7;}
   data[at(lx,y,lz)]=b;
  }
 }
 const put=(x,y,z,b)=>{const lx=x-cx*16,lz=z-cz*16;if(lx>=0&&lx<16&&lz>=0&&lz<16&&y>=0&&y<WORLD_HEIGHT)data[at(lx,y,lz)]=b;};
 // Halo roots keep trees identical across chunk borders.
 for(let x=cx*16-2;x<cx*16+18;x++)for(let z=cz*16-2;z<cz*16+18;z++){
  const random=hash(x,0,z,seed+901);if(random>.025)continue;
  const c=columnAt(x,z,seed);if(c.top!==1||c.height<=SEA_LEVEL+1||random>(c.biome==='forest'?.025:.004)||caveAt(x,c.height,z,c.height,seed))continue;
  const h=4+Math.floor(hash(x,9,z,seed)*3);
  for(let y=c.height+1;y<=c.height+h;y++)put(x,y,z,4);
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=-1;dy<=2;dy++)if(Math.abs(dx)+Math.abs(dz)+Math.max(0,dy)<5&&(dx||dz||dy>0))put(x+dx,c.height+h+dy,z+dz,5);
 }
 return {cx,cz,data,columns};
}
export function findSpawn(seed){
 for(let r=0;r<=12;r++)for(let i=0;i<(r?8:1);i++){
  const x=32+Math.round(Math.cos(i*Math.PI/4)*r*16),z=32+Math.round(Math.sin(i*Math.PI/4)*r*16),c=columnAt(x,z,seed);
  if(c.height>SEA_LEVEL+2&&c.biome!=='canyon'&&!caveAt(x,c.height,z,c.height,seed)&&Math.abs(c.height-columnAt(x+2,z+2,seed).height)<3)return [x+.5,c.height+2,z+.5];
 }
 return [32.5,columnAt(32,32,seed).height+2,32.5];
}
export function createTerrainWorld(seed,initialEdits=[]){
 const chunks=new Map(),patches=new Map(),patchChunks=new Map();
 const keyFor=(x,z)=>Math.floor(x/16)+','+Math.floor(z/16);
 function remember(e){const key=e.slice(0,3).join(',');patches.set(key,e);const ck=keyFor(e[0],e[2]);if(!patchChunks.has(ck))patchChunks.set(ck,new Map());patchChunks.get(ck).set(key,e);}
 for(const e of initialEdits)remember(e);
 function chunk(cx,cz){
  const key=cx+','+cz;if(chunks.has(key))return chunks.get(key);
  const c=generateChunk(seed,cx,cz);
  for(const e of patchChunks.get(key)?.values()||[])c.data[at(e[0]-cx*16,e[1],e[2]-cz*16)]=e[3];
  chunks.set(key,c);return c;
 }
 const world={seed,infinite:true,height:WORLD_HEIGHT,seaLevel:SEA_LEVEL,chunks,spawn:findSpawn(seed),crystals:[],chunk,
  accept(c){const key=c.cx+','+c.cz;if(chunks.has(key))return;for(const e of patchChunks.get(key)?.values()||[])c.data[at(e[0]-c.cx*16,e[1],e[2]-c.cz*16)]=e[3];chunks.set(key,c);},
  peek(x,y,z){if(y<0||y>=WORLD_HEIGHT)return 0;const cx=Math.floor(x/16),cz=Math.floor(z/16),c=chunks.get(cx+','+cz);return c?c.data[at(x-cx*16,y,z-cz*16)]:0;},
  get(x,y,z){if(y<0||y>=WORLD_HEIGHT||Math.abs(x)>1000000||Math.abs(z)>1000000)return 0;const cx=Math.floor(x/16),cz=Math.floor(z/16);return chunk(cx,cz).data[at(x-cx*16,y,z-cz*16)];},
  set(x,y,z,b){if(y<1||y>=WORLD_HEIGHT)return;const cx=Math.floor(x/16),cz=Math.floor(z/16);chunk(cx,cz).data[at(x-cx*16,y,z-cz*16)]=b;remember([x,y,z,b]);},
  column(x,z){const cx=Math.floor(x/16),cz=Math.floor(z/16),loaded=chunks.get(cx+','+cz);return loaded?loaded.columns[x-cx*16+(z-cz*16)*16]:columnAt(x,z,seed);},
  trim(cx,cz,radius=5){for(const [key,c] of chunks)if(Math.abs(c.cx-cx)>radius||Math.abs(c.cz-cz)>radius)chunks.delete(key);},
 };
 return world;
}
