import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookDirection,mouseLook} from '../camera.js';
import {VERTEX_SHADER} from '../renderer.js';
import {createWorld,cast} from '../world.js';
import {atlasPixels} from '../textures.js';
import {Saves,validateWorld,craft,RECIPES} from '../storage.js';

// Evaluate the actual camera expressions shipped to the GPU, rather than a copy.
function shaderView(point,yaw,pitch){
 const expressions=[...VERTEX_SHADER.matchAll(/float (x|depth|y|z)=([^;]+);/g)].map(m=>`const ${m[1]}=${m[2]};`).join('\n');
 const run=new Function('p','sy','cy','sp','cp',expressions+'return [x,y,z];');
 return run({x:point[0],y:point[1],z:point[2]},Math.sin(yaw),Math.cos(yaw),Math.sin(pitch),Math.cos(pitch));
}
test('Mining direction projects to the exact crosshair at all camera angles',()=>{
 for(const yaw of [-3,-1.2,0,.8,3])for(const pitch of [-1.4,-.7,0,.7,1.4]){
  const p=shaderView(lookDirection(yaw,pitch).map(v=>v*5),yaw,pitch);
  assert.ok(Math.abs(p[0])<1e-12);assert.ok(Math.abs(p[1])<1e-12);assert.ok(Math.abs(p[2]+5)<1e-12);
 }
});
test('Moving mouse up looks up and the inversion option reverses it',()=>{
 const [,normal]=mouseLook(0,0,0,-30,.0025,false),[,inverted]=mouseLook(0,0,0,-30,.0025,true);
 assert.ok(normal>0);assert.ok(lookDirection(0,normal)[1]>0);assert.ok(inverted<0);
 const above=shaderView([0,1,-5],0,normal);assert.ok(above[1]<1,'world moves down as camera looks up');
});
test('Voxel traversal chooses nearest block and a face-adjacent placement cell',()=>{
 const w={get:(x,y,z)=>(x===2&&y===2&&z===2)||(x===4&&y===4&&z===4)?3:0};
 for(const dir of [[1,1,1],[2,2,2]]){
  const hit=cast(w,[.5,.5,.5],dir,10);assert.deepEqual(hit.cell,[2,2,2]);assert.equal(hit.cell.reduce((s,v,i)=>s+Math.abs(v-hit.previous[i]),0),1);
 }
 assert.equal(cast(w,[.5,.5,.5],[1,1,1],1),null);
});
class MemoryStorage{
 map=new Map();get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}
}
const makeSave=(id='a')=>({version:2,id,name:'Остров',mode:'survival',seed:42,position:[32,20,32],yaw:.3,pitch:.5,inventory:{4:2},edits:[],found:[],health:20,updated:1});
test('Worlds save independently, survive reload and can be deleted individually',()=>{
 const memory=new MemoryStorage(),saves=new Saves(memory);saves.write(makeSave());saves.write({...makeSave('b'),inventory:{3:8},mode:'creative'});
 const reopened=new Saves(memory);assert.equal(reopened.list().length,2);assert.equal(reopened.list().find(s=>s.id==='a').inventory[4],2);
 reopened.remove('a');assert.deepEqual(reopened.list().map(s=>s.id),['b']);
});
test('Legacy migration preserves island, edits and crystals exactly once',()=>{
 const memory=new MemoryStorage(),old={version:1,seed:42,position:[32,20,32],yaw:1,pitch:.2,edits:[[5,10,5,4]],found:[0,2]};
 memory.setItem('cube-world-v1',JSON.stringify(old));const saves=new Saves(memory);saves.migrate();saves.migrate();
 assert.equal(saves.list().length,1);const s=saves.list()[0];assert.equal(s.mode,'creative');assert.deepEqual(s.edits,old.edits);assert.deepEqual(s.found,old.found);assert.ok(memory.getItem('cube-world-v1'));
});
test('Inventory crafting consumes ingredients only when available',()=>{
 const inventory={4:1};assert.equal(craft(inventory,RECIPES[0],'survival'),true);assert.equal(inventory[4],0);assert.equal(inventory[8],4);
 assert.equal(craft(inventory,RECIPES[0],'survival'),false);assert.equal(inventory[8],4);
 assert.equal(craft(inventory,RECIPES[1],'creative'),true);assert.equal(inventory[9],4);
});
test('World validation rejects impossible positions, items and health',()=>{
 for(const s of [{...makeSave(),position:[1e99,20,32]},{...makeSave(),inventory:{99:1}},{...makeSave(),health:0},{...makeSave(),edits:[[0,1,0,7]]}])assert.throws(()=>validateWorld(s));
});
test('Both texture detail levels contain deterministic, non-flat original water artwork',()=>{
 for(const size of [16,32]){const a=atlasPixels(size),b=atlasPixels(size);assert.equal(a.width,size*8);assert.deepEqual(a.data,b.data);const water=new Set();for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=((size+y)*a.width+size+x)*4;water.add(a.data[i]);assert.equal(a.data[i+3],255);}assert.ok(water.size>8);}
});
