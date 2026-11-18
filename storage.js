import {restoreSave,SIZE,HEIGHT,BLOCKS} from './world.js?v=4';
import {MATERIALS} from './items.js?v=4';
export const PALETTE=MATERIALS;
export const DEFAULT_SETTINGS={sensitivity:.0025,invertY:false,fov:75,texture:32,scale:1.5};
export const RECIPES=[{name:'Доски',input:4,cost:1,output:8,count:4},{name:'Кирпич',input:3,cost:4,output:9,count:4},{name:'Факелы',ingredients:[[4,1],[12,1]],output:13,count:4}];
export function canCraft(inventory,recipe,mode){return mode==='creative'||(recipe.ingredients||[[recipe.input,recipe.cost]]).every(([b,n])=>(inventory[b]||0)>=n);}
export function craft(inventory,recipe,mode){
 if(!canCraft(inventory,recipe,mode))return false;
 if(mode!=='creative')for(const [b,n] of recipe.ingredients||[[recipe.input,recipe.cost]])inventory[b]-=n;
 inventory[recipe.output]=(inventory[recipe.output]||0)+recipe.count;return true;
}
export function validateWorld(s){
 const infinite=['continental-v1','continental-v2'].includes(s?.generator),limit=infinite?1000000:SIZE,worldHeight=infinite?(s.generator==='continental-v2'?256:96):HEIGHT;
 if(s?.generator!==undefined&&!['island-v1','continental-v1','continental-v2'].includes(s.generator))throw Error('Unknown generator');
 if(![2,3,4].includes(s?.version)||typeof s.id!=='string'||s.id.length>100||typeof s.name!=='string'||s.name.length>50||!['creative','survival'].includes(s.mode)||!Number.isInteger(s.seed)||!Number.isFinite(s.yaw)||!Number.isFinite(s.pitch)||!Array.isArray(s.position)||s.position.length!==3||s.position.some((v,i)=>!Number.isFinite(v)||(i===1?(v<0||v>worldHeight+20):(v<(infinite?-limit:0)||v>limit)))||!Array.isArray(s.edits)||s.edits.length>200000)throw Error('Invalid world');
 for(const e of s.edits)if(!Array.isArray(e)||e.length!==4||e.some(v=>!Number.isInteger(v))||e[0]<(infinite?-limit:0)||e[0]>=limit||e[1]<1||e[1]>=worldHeight||e[2]<(infinite?-limit:0)||e[2]>=limit||!(e[3]===0||(BLOCKS[e[3]]&&!BLOCKS[e[3]].item&&e[3]!==7)))throw Error('Invalid edit');
 if(!Array.isArray(s.found)||s.found.some(v=>!Number.isInteger(v)||v<0||v>4)||!s.inventory||Object.entries(s.inventory).some(([k,v])=>!PALETTE.includes(Number(k))||!Number.isInteger(v)||v<0||v>999999)||!Number.isFinite(s.health)||s.health<1||s.health>20)throw Error('Invalid inventory');
 for(const [key,max] of [['hunger',20],['food',999999],['time',1e12],['crystals',999999],['vitalClock',4]])if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<0||s[key]>max))throw Error('Invalid survival state');
 if(s.hotbar!==undefined&&(!Array.isArray(s.hotbar)||![8,9].includes(s.hotbar.length)||s.hotbar.some(b=>!PALETTE.includes(b))))throw Error('Invalid hotbar');
 if(s.craftingGrid!==undefined&&(!Array.isArray(s.craftingGrid)||s.craftingGrid.length!==9||s.craftingGrid.some(b=>b!==0&&!PALETTE.includes(b))))throw Error('Invalid crafting grid');
 if(s.respawn!==undefined&&(!Array.isArray(s.respawn)||s.respawn.length!==3||s.respawn.some((v,i)=>!Number.isFinite(v)||Math.abs(v)>(i===1?worldHeight+20:limit))))throw Error('Invalid respawn');
 if(s.blockStates!==undefined){if(!s.blockStates||typeof s.blockStates!=='object'||Array.isArray(s.blockStates)||Object.keys(s.blockStates).length>20000)throw Error('Invalid block states');for(const [key,b] of Object.entries(s.blockStates)){if(!/^-?\d+,\d+,-?\d+$/.test(key)||!b||typeof b!=='object')throw Error('Invalid block state');if(b.contents&&Object.entries(b.contents).some(([id,n])=>!PALETTE.includes(Number(id))||!Number.isInteger(n)||n<0||n>999999))throw Error('Invalid chest');for(const field of ['inputCount','fuel','burn','progress','outputCount'])if(b[field]!==undefined&&(!Number.isFinite(b[field])||b[field]<0||b[field]>999999))throw Error('Invalid furnace');for(const field of ['input','output'])if(b[field]!==undefined&&b[field]!==0&&!PALETTE.includes(b[field]))throw Error('Invalid furnace item');}}
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
