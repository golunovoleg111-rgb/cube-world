import {hash} from './terrain.js?v=3';
import {cast} from './world.js?v=3';
export function rayBox(origin,dir,min,max,reach){
 let near=0,far=reach;
 for(let i=0;i<3;i++){
  if(Math.abs(dir[i])<1e-9){if(origin[i]<min[i]||origin[i]>max[i])return null;continue;}
  let a=(min[i]-origin[i])/dir[i],b=(max[i]-origin[i])/dir[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
 }
 return near;
}
export class MobSystem{
 constructor(world,seed,saved={}){this.world=world;this.seed=seed;this.mobs=saved.mobs?.map(m=>({...m,position:[...m.position]}))||[];this.dead=new Set(saved.dead||[]);this.spawnClock=2;}
 snapshot(){return {mobs:this.mobs.map(m=>({...m,position:[...m.position]})),dead:[...this.dead].slice(-4000)};}
 pick(origin,dir,reach=4){let closest=null,limit=reach;for(const mob of this.mobs){const [x,y,z]=mob.position;const distance=rayBox(origin,dir,[x-.45,y,z-.45],[x+.45,y+(mob.type==='hostile'?1.8:1.05),z+.45],limit);if(distance!==null){closest={mob,distance};limit=distance;}}return closest;}
 hit(mob){mob.health-=3;mob.flee=4;if(mob.health>0)return {killed:false,food:0};this.dead.add(mob.id);this.mobs=this.mobs.filter(m=>m!==mob);return {killed:true,food:mob.type==='hostile'?0:2};}
 surface(x,z){if(this.world.infinite)return this.world.column(x,z).height;let y=this.world.height-1;while(y>0&&!this.world.get(x,y,z))y--;return y;}
 spawn(player,night){
  const cx=Math.floor(player[0]/16),cz=Math.floor(player[2]/16);
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
   if(this.mobs.length>=24)return;
   const xchunk=cx+dx,zchunk=cz+dz;
   if(!this.world.infinite&&(xchunk<0||xchunk>3||zchunk<0||zchunk>3))continue;
   if(this.world.infinite&&!this.world.chunks.has(xchunk+','+zchunk))continue;
   const r=hash(xchunk,0,zchunk,this.seed+166);if(r<.38)continue;
   const type=night&&r>.7?'hostile':r>.65?'deer':'sheep';
   const id=`${xchunk}:${zchunk}:${type}`;if(this.dead.has(id)||this.mobs.some(m=>m.id===id))continue;
   const x=xchunk*16+3+Math.floor(hash(xchunk,3,zchunk,this.seed)*10),z=zchunk*16+3+Math.floor(hash(xchunk,5,zchunk,this.seed)*10),y=this.surface(x,z)+1;
   const distance=Math.hypot(x-player[0],z-player[2]);if(distance<7||distance>35||y<=this.world.seaLevel+1||this.world.get(x,y,z))continue;
   this.mobs.push({id,type,position:[x+.5,y,z+.5],health:type==='hostile'?12:6,heading:r*6.28,cooldown:0,vy:0,flee:0});
  }
 }
 tick(dt,player,{night,creative,onDamage}){
  this.spawnClock+=dt;if(this.spawnClock>2){this.spawnClock=0;this.spawn(player,night);}
  this.mobs=this.mobs.filter(m=>Math.hypot(m.position[0]-player[0],m.position[2]-player[2])<65&&m.position[1]>-5);
  for(const mob of this.mobs){
   const p=mob.position,dx=player[0]-p[0],dz=player[2]-p[2],distance=Math.hypot(dx,dz);
   mob.cooldown=Math.max(0,mob.cooldown-dt);mob.flee=Math.max(0,mob.flee-dt);
   if(mob.type==='hostile'&&!night){mob.health-=dt*2;if(mob.health<=0){this.dead.add(mob.id);continue;}}
   let speed=.55;
   if(mob.type==='hostile'&&!creative&&distance<22){mob.heading=Math.atan2(dx,dz);speed=1.65;}
   else if(mob.flee){mob.heading=Math.atan2(-dx,-dz);speed=2.4;}
   else mob.heading+=Math.sin(mob.position[0]*.15+mob.position[2]*.1)*dt*.5;
   for(const [axis,delta] of [[0,Math.sin(mob.heading)*speed*dt],[2,Math.cos(mob.heading)*speed*dt]]){
    const next=[...p];next[axis]+=delta;
    if(!this.world.infinite&&(next[0]<1||next[0]>63||next[2]<1||next[2]>63)){mob.heading+=2;continue;}
    const x=Math.floor(next[0]),z=Math.floor(next[2]),y=Math.floor(p[1]);
    if(this.world.get(x,y,z)||this.world.get(x,y+1,z)){
      if(!this.world.get(x,y+1,z)&&!this.world.get(x,y+2,z)){p[1]=y+1.01;p[axis]+=delta;}else mob.heading+=dt*4;
    }else if(this.surface(x,z)>=this.world.seaLevel)p[axis]+=delta;
   }
   mob.vy=Math.max(-12,(mob.vy||0)-dt*18);const nextY=p[1]+mob.vy*dt;
   if(this.world.get(Math.floor(p[0]),Math.floor(nextY-.01),Math.floor(p[2]))){p[1]=Math.floor(nextY-.01)+1;mob.vy=0;}else p[1]=nextY;
   if(mob.type==='hostile'&&!creative&&distance<1.5&&Math.abs(p[1]-player[1])<1.7&&mob.cooldown===0){
    const eye=[p[0],p[1]+1.3,p[2]],dir=[dx,player[1]+1.2-eye[1],dz];if(!cast(this.world,eye,dir,distance)){onDamage(2);mob.cooldown=1;}
   }
  }
  this.mobs=this.mobs.filter(m=>m.health>0);
 }
}
