import {restoreSave,SIZE,HEIGHT} from './world.js?v=2';
export const PALETTE=[1,2,3,4,5,6,8,9];
export const DEFAULT_SETTINGS={sensitivity:.0025,invertY:false,fov:75,texture:16,scale:1.25};
export const RECIPES=[{name:'Доски',input:4,cost:1,output:8,count:4},{name:'Кирпич',input:3,cost:4,output:9,count:4}];
export function craft(inventory,recipe,mode){
 if(mode!=='creative'&&(inventory[recipe.input]||0)<recipe.cost)return false;
 if(mode!=='creative')inventory[recipe.input]-=recipe.cost;
 inventory[recipe.output]=(inventory[recipe.output]||0)+recipe.count;return true;
}
export function validateWorld(s){
 if(s?.version!==2||typeof s.id!=='string'||s.id.length>100||typeof s.name!=='string'||s.name.length>50||!['creative','survival'].includes(s.mode)||!Number.isInteger(s.seed)||!Number.isFinite(s.yaw)||!Number.isFinite(s.pitch)||!Array.isArray(s.position)||s.position.length!==3||s.position.some((v,i)=>!Number.isFinite(v)||v<0||v>(i===1?HEIGHT+20:SIZE))||!Array.isArray(s.edits)||s.edits.length>SIZE*SIZE*HEIGHT)throw Error('Invalid world');
 for(const e of s.edits)if(!Array.isArray(e)||e.length!==4||e.some(v=>!Number.isInteger(v))||e[0]<0||e[0]>=SIZE||e[1]<1||e[1]>=HEIGHT||e[2]<0||e[2]>=SIZE||![0,...PALETTE].includes(e[3]))throw Error('Invalid edit');
 if(!Array.isArray(s.found)||s.found.some(v=>!Number.isInteger(v)||v<0||v>4)||!s.inventory||Object.entries(s.inventory).some(([k,v])=>!PALETTE.includes(Number(k))||!Number.isInteger(v)||v<0||v>999999)||!Number.isFinite(s.health)||s.health<1||s.health>20)throw Error('Invalid inventory');return s;
}
export class Saves{
 constructor(storage){this.storage=storage;this.prefix='cube-world-v2:';}
 list(){const worlds=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key?.startsWith(this.prefix))try{worlds.push(validateWorld(JSON.parse(this.storage.getItem(key))))}catch{/* Retain corrupt data for recovery; never silently delete it. */}}return worlds.sort((a,b)=>(b.updated||0)-(a.updated||0));}
 write(world){validateWorld(world);this.storage.setItem(this.prefix+world.id,JSON.stringify(world));}
 remove(id){this.storage.removeItem(this.prefix+id);}
 migrate(){if(this.storage.getItem('cube-world-migrated-v1'))return;const raw=this.storage.getItem('cube-world-v1');if(!raw)return;const old=restoreSave(raw);const world={...old,version:2,id:'legacy-island',name:'Мой первый остров',mode:'creative',inventory:{},health:20,updated:Date.now()};this.write(world);this.storage.setItem('cube-world-migrated-v1','yes');}
}
