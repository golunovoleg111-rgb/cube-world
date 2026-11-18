export const cellKey=cell=>cell.join(',');
export const FURNACE_RECIPES={6:14,27:39,36:37,25:3};
export function orientation(yaw){return Math.abs(Math.sin(yaw))>Math.abs(Math.cos(yaw))?[Math.sin(yaw)>0?-1:1,0,0]:[0,0,Math.cos(yaw)>0?-1:1];}
export function placement(world,cell,item,yaw){
 const cells=[[...cell,item]];
 if(item===15)cells.push([cell[0],cell[1]+1,cell[2],16]);
 if(item===19){const d=orientation(yaw);cells.push([cell[0]+d[0],cell[1],cell[2]+d[2],44]);}
 if(cells.some(([x,y,z])=>y<1||y>=world.height||(!world.infinite&&(x<0||x>=64||z<0||z>=64))||world.get(x,y,z)))return null;
 return cells;
}
export function toggleDoor(world,cell){const id=world.get(...cell),bottom=[...cell];if([16,32].includes(id))bottom[1]--;const current=world.get(...bottom);if(![15,31].includes(current))return null;return [[...bottom,current===15?31:15],[bottom[0],bottom[1]+1,bottom[2],current===15?32:16]];}
export function newBlockState(item,cell,yaw){const state={facing:orientation(yaw)};if(item===17)state.contents={};if(item===18)Object.assign(state,{input:0,inputCount:0,fuel:0,burn:0,progress:0,output:0,outputCount:0});if(item===19)state.partner=placement({get:()=>0,height:10000,infinite:true},cell,item,yaw)[1].slice(0,3);return state;}
export function tickFurnace(furnace,dt){
 const result=FURNACE_RECIPES[furnace.input];if(!result||furnace.inputCount<1||(furnace.output&&furnace.output!==result)||furnace.outputCount>=64){if(furnace.burn>0){furnace.burn=Math.max(0,furnace.burn-dt);return true;}return false;}
 if(furnace.burn<=0){if(furnace.fuel<=0)return false;furnace.fuel--;furnace.burn=24;}
 const used=Math.min(dt,furnace.burn);furnace.burn-=used;furnace.progress+=used;
 if(furnace.progress>=6){furnace.progress-=6;furnace.inputCount--;furnace.output=result;furnace.outputCount++;}
 return used>0;
}
export function moveStack(from,to,item,count=64){const n=Math.min(count,from[item]||0);if(n<=0)return 0;from[item]-=n;to[item]=(to[item]||0)+n;return n;}
export function bedSafe(world,cell){for(const dx of [-1,1,0])for(const dz of [-1,1,0]){if(!dx&&!dz)continue;const x=cell[0]+dx,z=cell[2]+dz,y=cell[1];if(!world.get(x,y,z)&&!world.get(x,y+1,z)&&world.get(x,y-1,z))return [x+.5,y+.05,z+.5];}return null;}
