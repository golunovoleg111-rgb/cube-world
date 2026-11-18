import {createWorld,overlaps,cast,BLOCKS,HEIGHT,SIZE} from './world.js?v=4';
import {Renderer,blockTile} from './renderer.js?v=4';
import {atlasPixels} from './textures.js?v=4';
import {lookDirection,mouseLook} from './camera.js?v=4';
import {Saves,DEFAULT_SETTINGS,PALETTE} from './storage.js?v=4';
import {createTerrainWorld,findSpawn,BIOMES} from './terrain.js?v=4';
import {MobSystem} from './mobs.js?v=4';
import {tickVitals,dayLight} from './survival.js?v=4';
import {DEFAULT_BAR,returnGrid} from './items.js?v=4';
import {placement,toggleDoor,newBlockState,tickFurnace,bedSafe,cellKey} from './mechanisms.js?v=4';
import {renderInventory,renderContext} from './inventory-ui.js?v=4';
import {spacePress} from './controls.js?v=4';

const $=id=>document.getElementById(id),canvas=$('world');
const iconAtlas=atlasPixels(32),iconCanvas=document.createElement('canvas');iconCanvas.width=iconCanvas.height=iconAtlas.width;iconCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(iconAtlas.data),iconAtlas.width,iconAtlas.width),0,0);const iconURL=iconCanvas.toDataURL();
let renderer;
try{renderer=new Renderer(canvas);}catch(error){$('unsupported').hidden=false;throw error;}
let saves,settings={...DEFAULT_SETTINGS},savedWorlds=[];
try{
  saves=new Saves(localStorage);
  try{saves.migrate();}catch{$('notice').textContent='Старое сохранение не удалось перенести. Оно оставлено без изменений.';}
  savedWorlds=saves.list();
  const stored=JSON.parse(localStorage.getItem('cube-world-settings')||'{}');
  for(const key of stored.graphicsVersion===3?Object.keys(settings):[]){
    const value=stored[key];
    if(key==='invertY'&&typeof value==='boolean')settings[key]=value;
    else if(key==='sensitivity'&&Number.isFinite(value)&&value>=.0005&&value<=.005)settings[key]=value;
    else if(key==='fov'&&[75,90].includes(value))settings[key]=value;
  }
  if(stored.graphicsVersion!==3)localStorage.setItem('cube-world-settings',JSON.stringify({...settings,graphicsVersion:3}));
}catch{$('notice').textContent='Хранилище браузера недоступно. Играть можно, но миры не сохранятся после закрытия.';}
renderer.configure(settings);

let active=null,world=createWorld(42),position=[...world.spawn],yaw=0,pitch=0;
let state='menu',velocity=0,grounded=false,flying=false,selected=0,found=new Set(),edits=new Map(),dirty=false,target=null;
let drag=null,toastTimer,saveClock=0,breath=10,waterDamage=0,elapsed=0,lastRender=0;
let mobs=new MobSystem(world,42),attackCooldown=0,hotbar=[...DEFAULT_BAR],travelClock=0,invulnerable=0;
let interactionContext=null,lastSpace=0,thirdPerson=false,handSwing=0;
const keys=new Set();
renderer.rebuild(world);

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
function eye(){return [position[0],position[1]+1.5,position[2]];}
function creative(){return active?.mode==='creative';}
function snapshot(){return {...active,position:[...position],yaw,pitch,found:[...found],edits:[...edits.values()],hotbar:[...hotbar],entities:mobs.snapshot(),updated:Date.now()};}
function save(){
  if(!active||!dirty)return true;
  const data=snapshot();
  try{
    if(!saves)throw Error('No storage');
    saves.write(data);active=data;dirty=false;
    savedWorlds=[data,...savedWorlds.filter(w=>w.id!==data.id)].sort((a,b)=>b.updated-a.updated);
    $('save-status').textContent='✓ Мир сохранён';return true;
  }catch{
    $('save-status').textContent='Не удалось сохранить';
    $('notice').textContent='Не удалось сохранить мир. Проверь свободное место и доступ к хранилищу браузера.';return false;
  }
}
function safeSpawn(){
  if(active?.respawn){const p=[...active.respawn];if(!overlaps(world,p))return p;}
  const [sx,,sz]=world.spawn,x=Math.floor(sx),z=Math.floor(sz);let top=world.height-1;
  while(top>0&&!world.get(x,top,z))top--;
  return [x+.5,top+1.05,z+.5];
}
function loadWorld(data){
  if(!save())return false;
  active=structuredClone(data);active.hunger??=20;active.time??=225;active.crystals??=0;active.blockStates??={};active.craftingGrid??=Array(9).fill(0);
  if(active.food){active.inventory[37]=(active.inventory[37]||0)+active.food;active.food=0;}
  world=active.generator?.startsWith('continental-')?createTerrainWorld(active.seed,active.edits,active.generator):createWorld(active.seed);world.states=active.blockStates;
  found=new Set(active.found);edits=new Map(active.edits.map(e=>[e.slice(0,3).join(','),e]));
  if(!world.infinite){for(const i of found)world.set(...world.crystals[i],0);for(const e of edits.values())world.set(...e);}
  position=[...active.position];yaw=active.yaw;pitch=Math.max(-1.5,Math.min(1.5,active.pitch));
  if(overlaps(world,position))position=safeSpawn();
  velocity=0;grounded=false;flying=false;breath=10;dirty=false;target=null;interactionContext=null;lastSpace=0;thirdPerson=false;
  hotbar=active.hotbar?[...active.hotbar]:[...DEFAULT_BAR];if(hotbar.length===8)hotbar.push(37);mobs=new MobSystem(world,active.seed,active.entities);
  renderer.rebuild(world,position);updateHUD();updateInventory();$('resume').hidden=false;
  $('save-status').textContent=active.name;return true;
}
function selectTab(name){
  $('create-form').hidden=true;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  for(const tab of ['worlds','settings','help'])$('tab-'+tab).hidden=tab!==name;
}
function worldList(){
  const list=$('world-list');list.replaceChildren();
  if(!savedWorlds.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='Здесь появятся твои острова. Создай первый — и сделай его своим.';list.append(empty);}
  for(const w of savedWorlds){
    const card=document.createElement('article');card.className='world-card';
    const icon=document.createElement('span');icon.className='world-icon';
    const details=document.createElement('div');details.className='world-details';
    const title=document.createElement('strong');title.textContent=w.name;
    const subtitle=document.createElement('small');subtitle.textContent=`${w.mode==='creative'?'Творчество':'Выживание'} · ${w.generator==='continental-v2'?'Мир 256':w.generator==='continental-v1'?'Большой мир 96':'Классический остров'}`;
    details.append(title,subtitle);
    const play=document.createElement('button');play.textContent='Играть ↗';play.onclick=()=>{if(loadWorld(w))resume();};
    const remove=document.createElement('button');remove.className='delete-world';remove.textContent='✕';remove.setAttribute('aria-label','Удалить мир '+w.name);
    remove.onclick=()=>{
      if(!confirm(`Удалить мир «${w.name}»? Постройки и прогресс этого мира будут потеряны.`))return;
      try{saves.remove(w.id);savedWorlds=savedWorlds.filter(item=>item.id!==w.id);if(active?.id===w.id){active=null;dirty=false;$('resume').hidden=true;}worldList();}catch{toast('Не удалось удалить мир');}
    };
    card.append(icon,details,play,remove);list.append(card);
  }
}
function showMenu(){
  if(active)returnGrid(active.inventory,active.craftingGrid,creative());
  state='menu';keys.clear();drag=null;document.exitPointerLock?.();
  $('menu').hidden=false;$('hud').hidden=true;$('inventory').hidden=true;
  $('inventory-button').hidden=true;$('pause-button').hidden=true;
  save();worldList();selectTab('worlds');
}
async function resume(){
  if(!active)return;
  returnGrid(active.inventory,active.craftingGrid,creative());interactionContext=null;dirty=true;
  if(matchMedia('(pointer:coarse)').matches){$('notice').textContent='Эта версия рассчитана на клавиатуру и мышь. Открой игру на компьютере.';return;}
  state='playing';$('menu').hidden=true;$('hud').hidden=false;$('inventory').hidden=true;
  $('inventory-button').hidden=false;$('pause-button').hidden=false;keys.clear();
  document.activeElement?.blur();
  try{
    if(!canvas.requestPointerLock)throw Error('Pointer lock unavailable');
    await canvas.requestPointerLock();
  }catch{toast('Обзор: зажми мышь и тяни. R — добыть, Q — поставить.');}
}
function openInventory(context=null){
  if(state!=='playing')return;
  state='inventory';keys.clear();drag=null;document.exitPointerLock?.();
  interactionContext=context;$('inventory').hidden=false;updateInventory();save();
}
function select(n){selected=(n+9)%9;updateInventory();}
function blockIcon(b){const icon=document.createElement('span');icon.className='block-icon';const tile=blockTile(b,0);icon.style.backgroundImage=`url(${iconURL})`;icon.style.backgroundSize='800% 800%';icon.style.backgroundPosition=`${tile%8/7*100}% ${Math.floor(tile/8)/7*100}%`;if(b===36||b===37){icon.textContent='🍖';icon.style.background='transparent';}if(b===38)icon.textContent='◈';return icon;}
function inventoryAPI(){return {player:active,creative:creative(),hotbar,selected,icon:blockIcon,changed:()=>{dirty=true;},notify:toast,context:interactionContext,onDay:()=>{active.time=dayLight(active.time).night?225:675;dirty=true;updateHUD();}};}
function updateInventory(){
  const barElement=$('hotbar');barElement.replaceChildren();
  for(const [i,b] of hotbar.entries()){
    const count=creative()?'∞':String(active?.inventory[b]||0);
    const slot=document.createElement('button');slot.className='slot'+(selected===i?' selected':'');slot.setAttribute('aria-pressed',String(selected===i));slot.setAttribute('aria-label',`${BLOCKS[b].name}: ${count}`);
    const key=document.createElement('kbd');key.textContent=i+1;const label=document.createElement('small');label.textContent=BLOCKS[b].name;const quantity=document.createElement('span');quantity.className='count';quantity.textContent=count;
    slot.append(key,blockIcon(b),label,quantity);slot.onclick=()=>select(i);barElement.append(slot);
  }
  if(active&&state==='inventory')renderInventory(inventoryAPI());
}
function updateHUD(){
  $('mode-label').textContent=creative()?`ТВОРЧЕСТВО${flying?' · ПОЛЁТ':''}`:'ВЫЖИВАНИЕ';
  const biome=world.infinite?BIOMES[world.column(Math.floor(position[0]),Math.floor(position[2])).biome]:'Классический остров';
  const phase=dayLight(active?.time??225);
  $('quest-title').textContent=biome;
  $('quest-progress').textContent=`${phase.night?'Ночь · остерегайся теней':'День · исследуй мир'} · Кристаллы ${world.infinite?active?.crystals||0:found.size}`;
  $('survival-status').textContent=creative()?(flying?'Полёт · Пробел ↑ · Shift ↓':'Двойной пробел — полёт · F5 — камера'):`♥ ${Math.ceil(active?.health||20)}/20 · Сытость ${Math.ceil(active?.hunger??20)}/20${breath<9?` · Воздух ${Math.ceil(breath)} с`:''}`;
}
function markEdit(cell,b){world.set(...cell,b);edits.set(cell.join(','),[...cell,b]);renderer.update(world,cell[0],cell[2]);dirty=true;}
function useSelected(){
 const b=hotbar[selected],id=target?world.get(...target.cell):0;
 if(target&&!keys.has('ShiftLeft')&&!keys.has('ShiftRight')){
  if([15,16,31,32].includes(id)){for(const e of toggleDoor(world,target.cell)||[])markEdit(e.slice(0,3),e[3]);toast('Дверь переключена');return;}
  if([17,18,29].includes(id)){const key=cellKey(target.cell);active.blockStates[key]??=newBlockState(id,target.cell,yaw);openInventory({kind:id===17?'chest':id===18?'furnace':'craft',data:active.blockStates[key],cell:[...target.cell]});return;}
  if(id===19||id===44){const root=active.blockStates[cellKey(target.cell)]?.root||target.cell,p=bedSafe(world,root);if(!p){toast('Рядом с кроватью нужно свободное место');return;}active.respawn=p;active.respawnBed=cellKey(root);dirty=true;if(dayLight(active.time).night){if(mobs.mobs.some(m=>m.type==='hostile'&&Math.hypot(m.position[0]-position[0],m.position[2]-position[2])<8)){toast('Нельзя уснуть: рядом противники');return;}active.time=225;active.health=Math.min(20,active.health+4);toast('Доброе утро. Точка возрождения обновлена.');}else toast('Точка возрождения установлена. Спать можно ночью.');updateHUD();return;}
 }
 if(b===36||b===37){if(creative()){toast('В творчестве сытость не тратится');return;}if(!(active.inventory[b]>0)){toast('В выбранном слоте нет еды');return;}if(active.hunger>19){toast('Ты пока сыт');return;}active.inventory[b]--;active.hunger=Math.min(20,active.hunger+(b===37?8:3));dirty=true;handSwing=1;toast('Сытость восстановлена');updateInventory();updateHUD();return;}
 if(b===38){if(!creative()&&!(active.inventory[b]>0)){toast('Сначала создай путевой камень');return;}if(!active.waypoint||keys.has('ShiftLeft')||keys.has('ShiftRight')){active.waypoint=[...position];dirty=true;toast('Место отмечено. ПКМ — расстояние, Shift+ПКМ — перенести.');}else{const [x,,z]=active.waypoint;toast(`Метка: X ${Math.floor(x)}, Z ${Math.floor(z)} · ${Math.round(Math.hypot(x-position[0],z-position[2]))} м`);}return;}
 if(BLOCKS[b].item){toast('Этот предмет используется в рецептах');return;}
 if(!target)return;
 const cell=target.previous;
 if(!creative()&&!(active.inventory[b]>0)){toast('Нет материала в выбранном слоте');return;}
 const cells=placement(world,cell,b,yaw);if(!cells){toast('Недостаточно свободного места');return;}
 for(const e of cells)world.set(...e);const blocked=overlaps(world,position);for(const e of cells)world.set(...e.slice(0,3),0);if(blocked)return;
 if(!creative())active.inventory[b]--;
 const baseKey=cellKey(cell);if([15,17,18,19,29].includes(b)){active.blockStates[baseKey]=newBlockState(b,cell,yaw);if(cells.length>1)active.blockStates[cellKey(cells[1].slice(0,3))]={root:[...cell],facing:active.blockStates[baseKey].facing};}
 for(const e of cells)markEdit(e.slice(0,3),e[3]);handSwing=1;updateInventory();
}
function destroyFunctional(cell,b){
 let root=[...cell];const metadata=active.blockStates[cellKey(cell)];if(metadata?.root)root=[...metadata.root];else if([16,32].includes(b))root[1]--;
 const rootId=world.get(...root),state=active.blockStates[cellKey(root)],cells=[root];
 if(rootId===19&&active.respawnBed===cellKey(root)){delete active.respawn;delete active.respawnBed;}
 if([15,31].includes(rootId))cells.push([root[0],root[1]+1,root[2]]);
 if(rootId===19&&state?.partner)cells.push(state.partner);
 if(state?.contents)for(const [id,n] of Object.entries(state.contents))active.inventory[id]=(active.inventory[id]||0)+n;
 if(rootId===18&&state){for(const [id,n] of [[state.input,state.inputCount],[state.output,state.outputCount],[12,state.fuel]])if(id&&n)active.inventory[id]=(active.inventory[id]||0)+n;}
 for(const c of cells){markEdit(c,0);delete active.blockStates[cellKey(c)];}
 return [15,16,31,32].includes(rootId)?15:rootId===44?19:rootId;
}
function interact(place=false){
  if(state!=='playing')return;
  // Recompute at click time: never mine a stale target from the previous frame.
  target=cast(world,eye(),lookDirection(yaw,pitch));
  if(place){useSelected();return;}
  handSwing=1;
  if(!place){const hit=mobs.pick(eye(),lookDirection(yaw,pitch),Math.min(4,target?.distance??4));if(hit){if(attackCooldown>0)return;const result=mobs.hit(hit.mob);active.inventory[36]=(active.inventory[36]||0)+result.food;if(result.killed&&hit.mob.type==='sheep')active.inventory[43]=(active.inventory[43]||0)+2;attackCooldown=.4;dirty=true;toast(result.killed?(result.food?`Добыто сырое мясо: ${result.food}`:'Враг побеждён'):'Попадание');updateInventory();return;}}
  if(!target)return;
  const cell=place?target.previous:target.cell,[x,y,z]=cell;
  if(y<1){toast('Основание острова нельзя разрушить');return;}
  if((!world.infinite&&(x<0||x>=SIZE||z<0||z>=SIZE))||y>=world.height){toast('Здесь проходит граница строительства');return;}
  if(place){
    if(world.get(...cell))return;
    const b=hotbar[selected];
    if(!creative()&&!(active.inventory[b]>0)){toast('Нет материала. Сначала добудь его или создай в инвентаре.');return;}
    world.set(...cell,b);const blocked=overlaps(world,position);world.set(...cell,0);if(blocked)return;
    if(!creative())active.inventory[b]--;
    markEdit(cell,b);
  }else{
    const b=world.get(...cell);
    if(b===7){
      if(world.infinite){active.crystals++;markEdit(cell,0);}else{const i=world.crystals.findIndex(c=>c.every((v,j)=>v===cell[j]));if(i>=0)found.add(i);world.set(...cell,0);renderer.update(world,x,z);}
      dirty=true;toast(`Кристалл найден! ${world.infinite?active.crystals:found.size}`);
    }else{
      const drop=destroyFunctional(cell,b);
      if(!creative())active.inventory[drop]=(active.inventory[drop]||0)+1;
    }
  }
  $('save-status').textContent='Есть несохранённые изменения';updateInventory();updateHUD();
}
function damage(amount){
  if(creative()||invulnerable>0)return;
  invulnerable=.6;
  $('damage-flash').classList.remove('visible');requestAnimationFrame(()=>$('damage-flash').classList.add('visible'));setTimeout(()=>$('damage-flash').classList.remove('visible'),220);
  active.health=Math.max(0,active.health-amount);dirty=true;
  if(active.health===0){active.health=20;active.hunger=20;position=safeSpawn();velocity=0;breath=10;renderer.rebuild(world,position);toast('Ты вернулся к точке появления. Собранные материалы сохранены.');}
  else toast(`Получен урон: ${amount}`);
  updateHUD();
}
function move(dt){
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const wet=position[1]+.7<world.seaLevel,sprint=(creative()||(active.hunger??20)>5)&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));
  const speed=(flying?7:sprint?6:4)*dt*(wet&&!flying?.6:1)/(Math.hypot(forward,right)||1);
  const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;
  for(const [axis,delta] of [[0,dx],[2,dz]]){position[axis]+=delta;if(overlaps(world,position))position[axis]-=delta;}
  if(flying){velocity=(Number(keys.has('Space'))-Number(sprint))*6;}
  else{
    if(grounded&&keys.has('Space')){velocity=7.6;grounded=false;}
    velocity-=dt*(wet?5:22);
    if(wet&&keys.has('Space'))velocity=Math.min(3,velocity+dt*18);
    if(wet)velocity=Math.max(-3,velocity);
  }
  const impact=velocity,steps=Math.max(1,Math.ceil(Math.abs(velocity*dt)/.12)),step=velocity*dt/steps;
  grounded=false;
  for(let i=0;i<steps;i++){
    position[1]+=step;
    if(overlaps(world,position)||position[1]>world.height+12){position[1]-=step;grounded=velocity<0;velocity=0;if(grounded&&impact<-11&&!flying)damage(Math.floor((-impact-10)*1.5));break;}
  }
  if(position[1]<-8){position=safeSpawn();velocity=0;damage(4);}
  if(dx||dz||velocity)dirty=true;
}

function bindSettings(){
  $('sensitivity').value=settings.sensitivity*1000;$('invert-y').checked=settings.invertY;
  for(const name of ['fov','texture','scale'])$(name).value=settings[name];
}
function applySettings(){
  settings={sensitivity:Number($('sensitivity').value)/1000,invertY:$('invert-y').checked,fov:Number($('fov').value),texture:Number($('texture').value),scale:Number($('scale').value)};
  renderer.configure(settings);try{localStorage.setItem('cube-world-settings',JSON.stringify({...settings,graphicsVersion:3}));}catch{toast('Настройки действуют, но сохранить их не удалось');}
}
bindSettings();for(const id of ['sensitivity','invert-y','fov','texture','scale'])$(id).addEventListener('input',applySettings);
$('reset-settings').onclick=()=>{settings={...DEFAULT_SETTINGS};bindSettings();applySettings();};
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>selectTab(button.dataset.tab));
$('new-world').onclick=()=>{$('tab-worlds').hidden=true;$('create-form').hidden=false;$('world-name').focus();};
$('cancel-create').onclick=()=>selectTab('worlds');
$('create-form').onsubmit=event=>{
  event.preventDefault();if(!save())return;
  const text=$('world-seed').value.trim();let seed=(Math.random()*4294967296)>>>0;
  if(text){seed=2166136261;for(const char of text)seed=Math.imul(seed^char.codePointAt(0),16777619)>>>0;}
  const generator=$('world-generator').value;
  const spawn=generator.startsWith('continental-')?findSpawn(seed,generator):createWorld(seed).spawn;
  const data={version:4,generator,id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${seed}`,name:$('world-name').value.trim()||'Новый мир',mode:$('world-mode').value,seed,position:[...spawn],yaw:0,pitch:0,edits:[],found:[],inventory:{37:2},health:20,hunger:20,food:0,time:225,crystals:0,blockStates:{},craftingGrid:Array(9).fill(0),updated:Date.now()};
  if(loadWorld(data)){dirty=true;save();worldList();resume();}
};
$('resume').onclick=resume;$('pause-button').onclick=showMenu;$('inventory-button').onclick=()=>openInventory();$('close-inventory').onclick=resume;
document.addEventListener('keydown',event=>{
  if(state==='menu')return;
  const code=event.code;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(code))event.preventDefault();
  if(state==='inventory'){if(['Escape','KeyE','KeyI'].includes(code)&&!event.repeat)resume();return;}
  if(['Escape','KeyP'].includes(code)){showMenu();return;}
  if(['KeyE','KeyI'].includes(code)&&!event.repeat){openInventory();return;}
  keys.add(code);
  if(/^Digit[1-9]$/.test(code))select(Number(code.at(-1))-1);
  if(!event.repeat&&code==='KeyR')interact();if(!event.repeat&&code==='KeyQ')interact(true);
  if(!event.repeat&&code==='Space'){const press=spacePress(lastSpace,performance.now(),creative());lastSpace=press.last;if(press.toggle){flying=!flying;velocity=0;lastSpace=0;updateHUD();toast(flying?'Полёт включён':'Полёт выключен');}}
  if(!event.repeat&&code==='F5'){event.preventDefault();thirdPerson=!thirdPerson;toast(thirdPerson?'Вид от третьего лица':'Вид от первого лица');}
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{if(state==='playing')showMenu();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state!=='menu')showMenu();});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='playing')showMenu();});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('mousedown',event=>{
  if(state!=='playing'||![0,2].includes(event.button))return;
  if(document.pointerLockElement===canvas)interact(event.button===2);
  else drag={x:event.clientX,y:event.clientY,button:event.button,total:0};
});
document.addEventListener('mouseup',()=>{if(drag){if(drag.total<3)interact(drag.button===2);drag=null;}});
document.addEventListener('mousemove',event=>{
  if(state!=='playing')return;
  let dx=0,dy=0;
  if(document.pointerLockElement===canvas){dx=event.movementX;dy=event.movementY;}
  else if(drag){dx=event.clientX-drag.x;dy=event.clientY-drag.y;drag.total+=Math.abs(dx)+Math.abs(dy);drag.x=event.clientX;drag.y=event.clientY;}else return;
  [yaw,pitch]=mouseLook(yaw,pitch,dx,dy,settings.sensitivity,settings.invertY);dirty=true;
});
canvas.addEventListener('wheel',event=>{if(state==='playing'){event.preventDefault();select(selected+Math.sign(event.deltaY));}},{passive:false});
window.addEventListener('pagehide',save);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();showMenu();$('notice').textContent='3D-контекст потерян. Обнови страницу; последнее сохранение можно открыть в списке миров.';});

let previous=performance.now(),hudClock=0;
function frame(now){
  const dt=Math.min((now-previous)/1000,.04);previous=now;elapsed+=dt;saveClock+=dt;hudClock+=dt;
  handSwing=Math.max(0,handSwing-dt*3);
  if(active&&state!=='menu'){for(const [key,block] of Object.entries(active.blockStates)){if(block.inputCount===undefined)continue;const wasBurning=block.burn>0;if(tickFurnace(block,dt)){dirty=true;if(wasBurning!==(block.burn>0)){const cell=key.split(',').map(Number);renderer.update(world,cell[0],cell[2]);}}}if(state==='inventory'&&interactionContext?.kind==='furnace'&&hudClock>.35){renderContext(inventoryAPI());hudClock=0;}}
  if(state==='playing'){
    active.time+=dt;attackCooldown=Math.max(0,attackCooldown-dt);invulnerable=Math.max(0,invulnerable-dt);renderer.stream(world,position);
    for(let i=0;i<3;i++)move(dt/3);
    if(!creative()){
      if(eye()[1]<world.seaLevel){breath=Math.max(0,breath-dt);if(breath===0){waterDamage+=dt;if(waterDamage>=1){damage(2);waterDamage=0;}}}else{breath=10;waterDamage=0;}
      const moving=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k));const vitals=tickVitals(active,dt,{moving,sprinting:keys.has('ShiftLeft')||keys.has('ShiftRight')});if(vitals.damage)damage(vitals.damage);if(vitals.changed)dirty=true;
    }
    mobs.tick(dt,position,{night:dayLight(active.time).night,creative:creative(),onDamage:damage});
    travelClock+=dt;if(travelClock>1){dirty=true;travelClock=0;}
    target=cast(world,eye(),lookDirection(yaw,pitch));
    const mobTarget=mobs.pick(eye(),lookDirection(yaw,pitch),Math.min(4,target?.distance??4));
    const direction=lookDirection(yaw,pitch);let renderEye=eye();if(thirdPerson){const backwards=direction.map(v=>-v),wall=cast(world,eye(),backwards,4),distance=wall?Math.max(.2,wall.distance-.2):4;renderEye=eye().map((v,i)=>v-direction[i]*distance);}
    renderer.render(renderEye,yaw,pitch,active.time,mobTarget?null:target,mobs.mobs,[13,30].includes(hotbar[selected])&&(creative()||active.inventory[hotbar[selected]]>0),{position,thirdPerson,item:creative()||active.inventory[hotbar[selected]]>0?hotbar[selected]:0,swing:handSwing,moving:['KeyW','KeyA','KeyS','KeyD'].some(k=>keys.has(k))});
    if(hudClock>.1){$('target').textContent=mobTarget?`${mobTarget.mob.type==='hostile'?'Ночной бродяга':mobTarget.mob.type==='sheep'?'Овца':'Олень'} · ♥ ${Math.ceil(mobTarget.mob.health)}`:target?BLOCKS[world.get(...target.cell)]?.name||'':'';$('coordinates').textContent=`${active.name} · X ${Math.floor(position[0])} Y ${Math.floor(position[1])} Z ${Math.floor(position[2])}`;updateHUD();hudClock=0;}
  }else if(now-lastRender>40){renderer.render(active?eye():[49,24,53],active?yaw:.65,active?pitch:-.38,active?.time??225,null,active?mobs.mobs:[]);lastRender=now;}
  if(saveClock>4){save();saveClock=0;}requestAnimationFrame(frame);
}
worldList();updateInventory();requestAnimationFrame(frame);
