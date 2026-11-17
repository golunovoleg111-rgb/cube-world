import {restoreSave,SIZE,HEIGHT} from './world.js?v=3';
export const PALETTE=[1,2,3,4,5,6,8,9,10,11,12,13];
export const DEFAULT_SETTINGS={sensitivity:.0025,invertY:false,fov:75,texture:32,scale:1.5};
export const RECIPES=[{name:'Доски',input:4,cost:1,output:8,count:4},{name:'Кирпич',input:3,cost:4,output:9,count:4},{name:'Факелы',ingredients:[[4,1],[12,1]],output:13,count:4}];
export function canCraft(inventory,recipe,mode){return mode==='creative'||(recipe.ingredients||[[recipe.input,recipe.cost]]).every(([b,n])=>(inventory[b]||0)>=n);}
export function craft(inventory,recipe,mode){
 if(!canCraft(inventory,recipe,mode))return false;
 if(mode!=='creative')for(const [b,n] of recipe.ingredients||[[recipe.input,recipe.cost]])inventory[b]-=n;
 inventory[recipe.output]=(inventory[recipe.output]||0)+recipe.count;return true;
}
export function validateWorld(s){
 const infinite=s?.generator==='continental-v1',limit=infinite?1000000:SIZE,worldHeight=infinite?96:HEIGHT;
 if(![2,3].includes(s?.version)||typeof s.id!=='string'||s.id.length>100||typeof s.name!=='string'||s.name.length>50||!['creative','survival'].includes(s.mode)||!Number.isInteger(s.seed)||!Number.isFinite(s.yaw)||!Number.isFinite(s.pitch)||!Array.isArray(s.position)||s.position.length!==3||s.position.some((v,i)=>!Number.isFinite(v)||(i===1?(v<0||v>worldHeight+20):(v<(infinite?-limit:0)||v>limit)))||!Array.isArray(s.edits)||s.edits.length>200000)throw Error('Invalid world');
 for(const e of s.edits)if(!Array.isArray(e)||e.length!==4||e.some(v=>!Number.isInteger(v))||e[0]<(infinite?-limit:0)||e[0]>=limit||e[1]<1||e[1]>=worldHeight||e[2]<(infinite?-limit:0)||e[2]>=limit||![0,...PALETTE].includes(e[3]))throw Error('Invalid edit');
 if(!Array.isArray(s.found)||s.found.some(v=>!Number.isInteger(v)||v<0||v>4)||!s.inventory||Object.entries(s.inventory).some(([k,v])=>!PALETTE.includes(Number(k))||!Number.isInteger(v)||v<0||v>999999)||!Number.isFinite(s.health)||s.health<1||s.health>20)throw Error('Invalid inventory');
 for(const [key,max] of [['hunger',20],['food',999999],['time',1e12],['crystals',999999],['vitalClock',4]])if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<0||s[key]>max))throw Error('Invalid survival state');
 if(s.hotbar!==undefined&&(!Array.isArray(s.hotbar)||s.hotbar.length!==8||s.hotbar.some(b=>!PALETTE.includes(b))))throw Error('Invalid hotbar');
 if(s.entities!==undefined){const e=s.entities;if(!e||!Array.isArray(e.mobs)||e.mobs.length>32||!Array.isArray(e.dead)||e.dead.length>4000||e.dead.some(id=>typeof id!=='string'||id.length>100))throw Error('Invalid entities');for(const m of e.mobs)if(typeof m.id!=='string'||m.id.length>100||!['sheep','deer','hostile'].includes(m.type)||!Array.isArray(m.position)||m.position.length!==3||m.position.some(v=>!Number.isFinite(v)||Math.abs(v)>1000000)||!Number.isFinite(m.health)||m.health<=0||m.health>12||!Number.isFinite(m.heading))throw Error('Invalid mob');}
 return s;
}
export class Saves{
 constructor(storage){this.storage=storage;this.prefix='cube-world-v2:';}
 list(){const worlds=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key?.startsWith(this.prefix))try{worlds.push(validateWorld(JSON.parse(this.storage.getItem(key))))}catch{/* Retain corrupt data for recovery; never silently delete it. */}}return worlds.sort((a,b)=>(b.updated||0)-(a.updated||0));}
 write(world){validateWorld(world);this.storage.setItem(this.prefix+world.id,JSON.stringify(world));}
 remove(id){this.storage.removeItem(this.prefix+id);}
 migrate(){if(this.storage.getItem('cube-world-migrated-v1'))return;const raw=this.storage.getItem('cube-world-v1');if(!raw)return;const old=restoreSave(raw);const world={...old,version:2,id:'legacy-island',name:'Мой первый остров',mode:'creative',inventory:{},health:20,updated:Date.now()};this.write(world);this.storage.setItem('cube-world-migrated-v1','yes');}
}
