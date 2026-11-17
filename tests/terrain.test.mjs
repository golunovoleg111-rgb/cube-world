import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateChunk,createTerrainWorld,columnAt,findSpawn,caveAt,BIOMES} from '../terrain.js';
import {validateWorld,craft,RECIPES,DEFAULT_SETTINGS} from '../storage.js';
import {tickVitals,eat,dayLight} from '../survival.js';
import {rayBox,MobSystem} from '../mobs.js';
import {overlaps} from '../world.js';
import {Renderer} from '../renderer.js';

test('World generation is stable at negative, positive and distant coordinates',()=>{
 for(const [cx,cz] of [[-3,2],[0,0],[18,-9],[62499,-62500]]){
  const a=generateChunk(42,cx,cz),b=generateChunk(42,cx,cz);assert.deepEqual(a.data,b.data);
  assert.ok(a.data.some(v=>v===3));assert.equal(a.data.length,16*16*96);
 }
 assert.notDeepEqual(generateChunk(42,0,0).data,generateChunk(43,0,0).data);
});
test('All five biomes, elevation changes, caves and canyons exist',()=>{
 const biomes=new Set(),heights=[];let canyons=0,caves=0;
 for(let x=-768;x<=768;x+=48)for(let z=-768;z<=768;z+=48){const c=columnAt(x,z,42);biomes.add(c.biome);heights.push(c.height);if(c.canyon>.5)canyons++;for(let y=4;y<c.height-3;y+=3)if(caveAt(x,y,z,c.height,42))caves++;}
 assert.deepEqual([...biomes].sort(),Object.keys(BIOMES).sort());assert.ok(Math.max(...heights)-Math.min(...heights)>40);assert.ok(canyons>0);assert.ok(caves>100);
});
test('Chunk borders match direct generation and edits survive unload/reload',()=>{
 const w=createTerrainWorld(42);w.chunk(-1,0);w.chunk(0,0);
 const c=generateChunk(42,-1,0);
 for(let z=0;z<16;z++)for(let y=0;y<96;y++)assert.equal(w.get(-1,y,z),c.data[15+16*(z+16*y)]);
 w.set(-1,70,0,8);w.set(0,70,0,13);w.trim(20,20,1);assert.equal(w.chunks.size,0);
 assert.equal(w.get(-1,70,0),8);assert.equal(w.get(0,70,0),13);
 const restored=createTerrainWorld(42,[[-1,70,0,8],[0,70,0,13]]);assert.equal(restored.get(-1,70,0),8);
});
test('Streaming evicts old data without losing saved edits',()=>{
 const world=createTerrainWorld(123);for(let x=-8;x<=8;x++)world.chunk(x,0);world.trim(0,0,3);assert.equal(world.chunks.size,7);
 const position=findSpawn(123);assert.ok(position[1]>world.seaLevel);assert.equal(overlaps(world,[1000,95,-1000]),false);
});
test('Worker results receive edits made after a generation request',()=>{
 const w=createTerrainWorld(42,[[2,70,2,8]]),c=generateChunk(42,0,0);w.accept(c);assert.equal(w.get(2,70,2),8);
 w.set(2,70,2,9);w.accept(generateChunk(42,0,0));assert.equal(w.get(2,70,2),9);
});
test('Survival: movement spends hunger, food is consumed, high hunger regenerates health',()=>{
 const a={health:10,hunger:20,food:2},b={health:20,hunger:20,food:2};
 tickVitals(a,4,{moving:true,sprinting:true});assert.equal(a.health,11);assert.ok(a.hunger<20);
 tickVitals(b,4,{moving:true});assert.ok(b.hunger>a.hunger);
 assert.equal(eat(a),true);assert.equal(a.food,1);assert.equal(a.hunger,20);
 assert.equal(eat(a),false);const starving={health:10,hunger:0};assert.equal(tickVitals(starving,4).damage,1);
});
test('Torch crafting is atomic and consumes both resources',()=>{
 const recipe=RECIPES.find(r=>r.output===13),inventory={4:1,12:0};assert.equal(craft(inventory,recipe,'survival'),false);assert.equal(inventory[4],1);
 inventory[12]=1;assert.equal(craft(inventory,recipe,'survival'),true);assert.equal(inventory[4],0);assert.equal(inventory[12],0);assert.equal(inventory[13],4);
});
test('Day and night cycle repeats and changes brightness',()=>{assert.equal(dayLight(225).day,1);assert.equal(dayLight(675).night,true);assert.ok(dayLight(675).day<.1);assert.deepEqual(dayLight(225),dayLight(1125));});
test('Mob ray tests cannot select through a closer block; defeated animals drop food once',()=>{
 assert.equal(rayBox([0,1,0],[0,0,-1],[-.5,0,-3.5],[.5,2,-2.5],2),null);
 const world=createTerrainWorld(42),mobs=new MobSystem(world,42);const mob={id:'test',type:'sheep',health:6,position:[0,0,-3],heading:0};mobs.mobs=[mob];
 assert.equal(mobs.pick([0,1,0],[0,0,-1],2),null);assert.equal(mobs.pick([0,1,0],[0,0,-1],4).mob,mob);
 assert.equal(mobs.hit(mob).killed,false);assert.equal(mobs.hit(mob).food,2);assert.equal(mobs.mobs.length,0);assert.ok(mobs.snapshot().dead.includes('test'));
});
test('Hostiles appear at night, attack nearby survival players and spare creative players',()=>{
 const flat={height:16,seaLevel:0,infinite:false,get:(x,y,z)=>y<5?3:0};
 const system=new MobSystem(flat,42);system.spawn([32,5,32],true);assert.ok(system.mobs.some(m=>m.type==='hostile'));assert.ok(system.mobs.some(m=>m.type==='sheep'||m.type==='deer'));
 system.mobs=[{id:'enemy',type:'hostile',position:[32,5,31],heading:0,health:12,cooldown:0,vy:0,flee:0}];
 let damage=0;system.tick(.016,[32,5,32],{night:true,creative:false,onDamage:n=>damage+=n});assert.equal(damage,2);
 system.mobs[0].cooldown=0;system.tick(.016,[32,5,32],{night:true,creative:true,onDamage:n=>damage+=n});assert.equal(damage,2);
});
test('New saves support negative coordinates and preserve legacy schema',()=>{
 const save={version:3,generator:'continental-v1',id:'a',name:'World',mode:'survival',seed:42,position:[-160,70,1000],yaw:0,pitch:0,found:[],edits:[[-160,60,1000,13]],inventory:{13:4},health:20,hunger:17,food:2,time:675};
 assert.equal(validateWorld(save),save);assert.throws(()=>validateWorld({...save,hunger:-1}));assert.throws(()=>validateWorld({...save,generator:'island-v1'}));
 assert.deepEqual(DEFAULT_SETTINGS,{sensitivity:.0025,invertY:false,fov:75,texture:32,scale:1.5});
});
test('Meshing uses chunk-local coordinates to avoid precision loss in distant terrain',()=>{
 const world=createTerrainWorld(42),uploads=[];const renderer=Object.create(Renderer.prototype);
 renderer.chunks=new Map();renderer.gl={ARRAY_BUFFER:1,STATIC_DRAW:2,createBuffer:()=>({}),bindBuffer:()=>{},bufferData:(_,data)=>uploads.push(data)};
 world.chunk(1000,-1000);renderer.build(world,1000,-1000);assert.ok(uploads[0].length>0);
 for(let i=0;i<uploads[0].length;i+=7){assert.ok(uploads[0][i]>=0&&uploads[0][i]<=16);assert.ok(uploads[0][i+2]>=0&&uploads[0][i+2]<=16);}
});
