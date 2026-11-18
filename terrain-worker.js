import {createTerrainWorld} from './terrain.js?v=4';
import {Renderer} from './renderer.js?v=4';
let world,identity='';
self.onmessage=({data:request})=>{
 try{
  const {seed,cx,cz,epoch,generator,revision,edits,states}=request,key=seed+':'+generator+':'+epoch;
  if(identity!==key){world=createTerrainWorld(seed,[],generator);identity=key;}
  world.states=states||{};for(const e of edits||[])world.set(...e);
  for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])world.chunk(cx+dx,cz+dz);
  const uploads=[],baker=Object.create(Renderer.prototype);baker.chunks=new Map();
  baker.gl={ARRAY_BUFFER:1,STATIC_DRAW:2,createBuffer:()=>({}),bindBuffer:()=>{},bufferData:(_,data)=>uploads.push(data)};
  baker.build(world,cx,cz);const baked=baker.chunks.get(cx+','+cz),source=world.chunk(cx,cz),chunk={...source,data:source.data.slice()},mesh={opaque:uploads[0],glass:uploads[1],lights:baked.lights};
  self.postMessage({chunk,mesh,epoch,revision},[chunk.data.buffer,mesh.opaque.buffer,mesh.glass.buffer]);world.trim(cx,cz,5);
 }catch(error){self.postMessage({error:String(error),epoch:request.epoch});}
};
