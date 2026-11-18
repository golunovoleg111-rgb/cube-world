import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES,fillRecipe,matchRecipe,completeCraft,returnGrid,DEFAULT_BAR} from '../items.js';
import {placement,toggleDoor,newBlockState,tickFurnace,moveStack,bedSafe} from '../mechanisms.js';
import {spacePress} from '../controls.js';
import {createTerrainWorld,generateChunk} from '../terrain.js';
import {isSolid,isOpaque} from '../world.js';
import {validateWorld} from '../storage.js';
test('Recipe book escrows ingredients and returning a grid cannot duplicate items',()=>{
 const inventory={8:8},grid=Array(9).fill(0),recipe=RECIPES.find(r=>r.output===17);
 assert.equal(fillRecipe(inventory,grid,recipe),true);assert.equal(inventory[8],0);assert.equal(matchRecipe(grid),recipe);
 const result=completeCraft(inventory,grid);assert.equal(result.output,17);assert.equal(inventory[17],1);returnGrid(inventory,grid);assert.equal(inventory[8],0);assert.equal(completeCraft(inventory,grid),null);
 inventory[4]=1;fillRecipe(inventory,grid,RECIPES[0]);returnGrid(inventory,grid);returnGrid(inventory,grid);assert.equal(inventory[4],1);
});
test('Crafting matches shifted shapes and rejects extra or truncated ingredients',()=>{const g=[0,0,0,0,4,0,0,0,0];assert.equal(matchRecipe(g).output,8);g[8]=12;assert.equal(matchRecipe(g),null);assert.equal(matchRecipe([0,0,8,0,0,8,0,0,8]),null);});
test('Double space toggles creative flight; single, slow or survival presses do not',()=>{assert.equal(spacePress(0,1000,true).toggle,false);assert.equal(spacePress(1000,1200,true).toggle,true);assert.equal(spacePress(1000,1400,true).toggle,false);assert.equal(spacePress(1000,1200,false).toggle,false);});
test('Door placement needs two empty cells and open doors do not block passage',()=>{
 const blocks=new Map(),w={height:256,infinite:true,get:(...c)=>blocks.get(c.join(','))||0};const cells=placement(w,[2,100,3],15,0);assert.equal(cells.length,2);for(const [x,y,z,b] of cells)blocks.set([x,y,z].join(','),b);
 assert.equal(placement(w,[2,100,3],15,0),null);const opened=toggleDoor(w,[2,101,3]);assert.deepEqual(opened.map(c=>c[3]),[31,32]);assert.equal(isSolid(15),true);assert.equal(isSolid(31),false);assert.equal(isOpaque(14),false);assert.equal(isSolid(14),true);assert.equal(placement(w,[2,255,3],15,0),null);
});
test('Beds occupy two cells and choose a safe nearby respawn',()=>{const w={height:256,infinite:true,get:(x,y,z)=>y<50?3:0};const cells=placement(w,[2,50,3],19,0);assert.equal(cells.length,2);assert.equal(cells[1][3],44);const p=bedSafe(w,[2,50,3]);assert.ok(p);assert.equal(Math.floor(p[1]),50);assert.deepEqual(newBlockState(19,[2,50,3],0).partner,cells[1].slice(0,3));});
test('Chests transfer actual quantities without generating resources',()=>{const bag={14:70},chest={};assert.equal(moveStack(bag,chest,14),64);assert.equal(bag[14],6);assert.equal(chest[14],64);assert.equal(moveStack(chest,bag,14),64);assert.equal(bag[14],70);assert.equal(chest[14],0);});
test('Furnaces consume fuel, smelt glass and continue cooling while idle',()=>{const f=newBlockState(18,[0,50,0],0);Object.assign(f,{input:6,inputCount:1,fuel:1});tickFurnace(f,6);assert.equal(f.output,14);assert.equal(f.outputCount,1);assert.equal(f.inputCount,0);assert.equal(f.fuel,0);assert.equal(f.burn,18);tickFurnace(f,3);assert.equal(f.burn,15);});
test('Tall terrain uses 256 blocks, while the old generator is unchanged',()=>{const a=generateChunk(42,0,0,'continental-v1'),b=generateChunk(42,0,0,'continental-v2');assert.equal(a.data.length,16*16*96);assert.equal(b.data.length,16*16*256);assert.ok(Math.max(...b.columns.map(c=>c.height))>Math.max(...a.columns.map(c=>c.height)));const w=createTerrainWorld(42,[],'continental-v2');w.set(-1,240,-1,14);assert.equal(w.get(-1,240,-1),14);w.trim(100,100,1);assert.equal(w.get(-1,240,-1),14);});
test('New generation produces distinct oak, birch and spruce trees',()=>{const logs=new Set();for(const seed of [42,123,777])for(const [x,z] of [[0,0],[10,10],[-10,-10],[20,-20],[-20,20]]){const data=generateChunk(seed,x,z,'continental-v2').data;for(const b of data)if([4,20,22].includes(b))logs.add(b);}assert.deepEqual([...logs].sort((a,b)=>a-b),[4,20,22]);});
test('New saves retain functional block state, crafting and nine quick slots',()=>{const s={version:4,generator:'continental-v2',id:'workshop',name:'World',mode:'survival',seed:42,position:[-1,240,1],yaw:0,pitch:0,edits:[[-1,240,1,17]],found:[],inventory:{14:4,37:2},health:20,hotbar:[...DEFAULT_BAR],craftingGrid:Array(9).fill(0),blockStates:{'-1,240,1':{contents:{14:64}}},respawn:[0,100,0]};assert.equal(validateWorld(s),s);assert.throws(()=>validateWorld({...s,craftingGrid:[99]}));assert.throws(()=>validateWorld({...s,respawn:[0,Infinity,0]}));});
