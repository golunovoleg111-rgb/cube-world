import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
test('Generation worker returns transferable terrain and both mesh passes with saved glass edits',async()=>{
 const worker=new Worker(new URL('./worker-harness.mjs',import.meta.url));
 try{
  const result=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  worker.postMessage({seed:42,cx:0,cz:0,generator:'continental-v2',epoch:1,revision:7,edits:[[2,240,2,14]],states:{}});
  const data=await result;assert.equal(data.error,undefined);assert.equal(data.chunk.data.length,16*16*256);assert.ok(data.mesh.opaque.length>0);assert.ok(data.mesh.glass.length>0);assert.equal(data.revision,7);
 }finally{await worker.terminate();}
});
