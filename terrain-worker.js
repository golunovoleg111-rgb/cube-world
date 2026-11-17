import {generateChunk} from './terrain.js?v=3';
self.onmessage=({data:{seed,cx,cz,epoch}})=>{try{const chunk=generateChunk(seed,cx,cz);self.postMessage({chunk,epoch},[chunk.data.buffer]);}catch(error){self.postMessage({error:String(error),epoch});}};
