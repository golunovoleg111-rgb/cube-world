import {createWorld,overlaps,cast,BLOCKS,HEIGHT,SIZE} from './world.js?v=3';
import {Renderer} from './renderer.js?v=3';
import {lookDirection,mouseLook} from './camera.js?v=3';
import {Saves,DEFAULT_SETTINGS,PALETTE,RECIPES,craft,canCraft} from './storage.js?v=3';
import {createTerrainWorld,findSpawn,BIOMES} from './terrain.js?v=3';
import {MobSystem} from './mobs.js?v=3';
import {tickVitals,eat,dayLight} from './survival.js?v=3';

const $=id=>document.getElementById(id),canvas=$('world');
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
let mobs=new MobSystem(world,42),attackCooldown=0,hotbar=PALETTE.slice(0,8),travelClock=0,invulnerable=0;
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
  const [sx,,sz]=world.spawn,x=Math.floor(sx),z=Math.floor(sz);let top=world.height-1;
  while(top>0&&!world.get(x,top,z))top--;
  return [x+.5,top+1.05,z+.5];
}
function loadWorld(data){
  if(!save())return false;
  active=structuredClone(data);active.hunger??=20;active.food??=0;active.time??=225;active.crystals??=0;
  world=active.generator==='continental-v1'?createTerrainWorld(active.seed,active.edits):createWorld(active.seed);
  found=new Set(active.found);edits=new Map(active.edits.map(e=>[e.slice(0,3).join(','),e]));
  if(!world.infinite){for(const i of found)world.set(...world.crystals[i],0);for(const e of edits.values())world.set(...e);}
  position=[...active.position];yaw=active.yaw;pitch=Math.max(-1.5,Math.min(1.5,active.pitch));
  if(overlaps(world,position))position=safeSpawn();
  velocity=0;grounded=false;flying=false;breath=10;dirty=false;target=null;
  hotbar=active.hotbar?[...active.hotbar]:PALETTE.slice(0,8);mobs=new MobSystem(world,active.seed,active.entities);
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
    const subtitle=document.createElement('small');subtitle.textContent=`${w.mode==='creative'?'Творчество':'Выживание'} · ${w.generator==='continental-v1'?'Большой мир':'Классический остров'}`;
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
  state='menu';keys.clear();drag=null;document.exitPointerLock?.();
  $('menu').hidden=false;$('hud').hidden=true;$('inventory').hidden=true;
  $('inventory-button').hidden=true;$('pause-button').hidden=true;
  save();worldList();selectTab('worlds');
}
async function resume(){
  if(!active)return;
  if(matchMedia('(pointer:coarse)').matches){$('notice').textContent='Эта версия рассчитана на клавиатуру и мышь. Открой игру на компьютере.';return;}
  state='playing';$('menu').hidden=true;$('hud').hidden=false;$('inventory').hidden=true;
  $('inventory-button').hidden=false;$('pause-button').hidden=false;keys.clear();
  document.activeElement?.blur();
  try{
    if(!canvas.requestPointerLock)throw Error('Pointer lock unavailable');
    await canvas.requestPointerLock();
  }catch{toast('Обзор: зажми мышь и тяни. R — добыть, Q — поставить.');}
}
function openInventory(){
  if(state!=='playing')return;
  state='inventory';keys.clear();drag=null;document.exitPointerLock?.();
  $('inventory').hidden=false;updateInventory();save();
}
function select(n){selected=(n+8)%8;updateInventory();}
function blockIcon(b){const icon=document.createElement('span');icon.className='block-icon';icon.style.backgroundColor=`rgb(${BLOCKS[b].color.map(v=>v*255).join(',')})`;return icon;}
function updateInventory(){
  const barElement=$('hotbar'),grid=$('inventory-grid');barElement.replaceChildren();grid.replaceChildren();
  for(const [i,b] of hotbar.entries()){
    const count=creative()?'∞':String(active?.inventory[b]||0);
    const slot=document.createElement('button');slot.className='slot'+(selected===i?' selected':'');slot.setAttribute('aria-pressed',String(selected===i));slot.setAttribute('aria-label',`${BLOCKS[b].name}: ${count}`);
    const key=document.createElement('kbd');key.textContent=i+1;const label=document.createElement('small');label.textContent=BLOCKS[b].name;const quantity=document.createElement('span');quantity.className='count';quantity.textContent=count;
    slot.append(key,blockIcon(b),label,quantity);slot.onclick=()=>select(i);barElement.append(slot);
  }
  for(const b of PALETTE){
    const count=creative()?'∞':String(active?.inventory[b]||0);
    const item=document.createElement('button');item.className='inventory-item'+(hotbar[selected]===b?' selected':'');item.setAttribute('aria-pressed',String(hotbar[selected]===b));
    const name=document.createElement('span');name.textContent=BLOCKS[b].name;const qty=document.createElement('small');qty.textContent=creative()?'Без ограничений':`В запасе: ${count}`;
    item.append(blockIcon(b),name,qty);item.onclick=()=>{hotbar[selected]=b;dirty=!!active;updateInventory();};grid.append(item);
  }
  $('inventory-description').textContent=creative()?'Все материалы бесконечны. Нажми на блок, чтобы назначить его в выбранный быстрый слот. F — полёт.':`Добывай ресурсы и собирай еду. Нажми на материал, чтобы назначить его в выбранный слот. Еда: ${active?.food||0}.`;
  $('eat-button').textContent=`Поесть (+6 сытости) · Еда: ${active?.food||0}`;$('eat-button').disabled=creative()||!active?.food||(active?.hunger??20)>=20;
  $('time-button').hidden=!creative();
  const recipes=$('recipes');recipes.replaceChildren();
  for(const recipe of RECIPES){
    const row=document.createElement('div');row.className='recipe';const text=document.createElement('span');text.textContent=(recipe.ingredients||[[recipe.input,recipe.cost]]).map(([b,n])=>`${BLOCKS[b].name} × ${n}`).join(' + ')+` → ${BLOCKS[recipe.output].name} × ${recipe.count}`;
    const button=document.createElement('button');button.textContent='Создать';button.disabled=!canCraft(active?.inventory||{},recipe,active?.mode);
    button.onclick=()=>{if(craft(active.inventory,recipe,active.mode)){dirty=true;updateInventory();toast(`Создано: ${BLOCKS[recipe.output].name} × ${recipe.count}`);}};
    row.append(text,button);recipes.append(row);
  }
}
function updateHUD(){
  $('mode-label').textContent=creative()?`ТВОРЧЕСТВО${flying?' · ПОЛЁТ':''}`:'ВЫЖИВАНИЕ';
  const biome=world.infinite?BIOMES[world.column(Math.floor(position[0]),Math.floor(position[2])).biome]:'Классический остров';
  const phase=dayLight(active?.time??225);
  $('quest-title').textContent=biome;
  $('quest-progress').textContent=`${phase.night?'Ночь · остерегайся теней':'День · исследуй мир'} · Кристаллы ${world.infinite?active?.crystals||0:found.size}`;
  $('survival-status').textContent=creative()?(flying?'Полёт · Пробел ↑ · Shift ↓':'F — полёт · B — путевой камень'):`♥ ${Math.ceil(active?.health||20)}/20 · Сытость ${Math.ceil(active?.hunger??20)}/20 · Еда ${active?.food||0} (C)${breath<9?` · Воздух ${Math.ceil(breath)} с`:''}`;
}
function markEdit(cell,b){world.set(...cell,b);edits.set(cell.join(','),[...cell,b]);renderer.update(world,cell[0],cell[2]);dirty=true;}
function interact(place=false){
  if(state!=='playing')return;
  // Recompute at click time: never mine a stale target from the previous frame.
  target=cast(world,eye(),lookDirection(yaw,pitch));
  if(!place){const hit=mobs.pick(eye(),lookDirection(yaw,pitch),Math.min(4,target?.distance??4));if(hit){if(attackCooldown>0)return;const result=mobs.hit(hit.mob);active.food+=result.food;attackCooldown=.4;dirty=true;toast(result.killed?(result.food?`Добыта еда: ${result.food}`:'Враг побеждён'):'Попадание');updateInventory();return;}}
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
      if(!creative())active.inventory[b]=(active.inventory[b]||0)+1;
      markEdit(cell,0);
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
  const spawn=generator==='continental-v1'?findSpawn(seed):createWorld(seed).spawn;
  const data={version:3,generator,id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${seed}`,name:$('world-name').value.trim()||'Новый мир',mode:$('world-mode').value,seed,position:[...spawn],yaw:0,pitch:0,edits:[],found:[],inventory:{},health:20,hunger:20,food:2,time:225,crystals:0,updated:Date.now()};
  if(loadWorld(data)){dirty=true;save();worldList();resume();}
};
$('resume').onclick=resume;$('pause-button').onclick=showMenu;$('inventory-button').onclick=openInventory;$('close-inventory').onclick=resume;
function haveMeal(){if(active&&!creative()&&eat(active)){dirty=true;toast('Сытость восстановлена');updateHUD();updateInventory();}}
$('eat-button').onclick=haveMeal;
$('time-button').onclick=()=>{if(!creative())return;active.time=dayLight(active.time).night?225:675;dirty=true;toast(dayLight(active.time).night?'Наступила ночь':'Наступил день');updateHUD();};
document.addEventListener('keydown',event=>{
  if(state==='menu')return;
  const code=event.code;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(code))event.preventDefault();
  if(state==='inventory'){if(['Escape','KeyE','KeyI'].includes(code)&&!event.repeat)resume();return;}
  if(['Escape','KeyP'].includes(code)){showMenu();return;}
  if(['KeyE','KeyI'].includes(code)&&!event.repeat){openInventory();return;}
  keys.add(code);
  if(/^Digit[1-8]$/.test(code))select(Number(code.at(-1))-1);
  if(!event.repeat&&code==='KeyR')interact();if(!event.repeat&&code==='KeyQ')interact(true);
  if(!event.repeat&&code==='KeyC')haveMeal();
  if(!event.repeat&&code==='KeyB'){if(active.waypoint){const [x,,z]=active.waypoint;toast(`Путевой камень: X ${Math.floor(x)}, Z ${Math.floor(z)} · ${Math.round(Math.hypot(x-position[0],z-position[2]))} м`);}else{active.waypoint=[...position];dirty=true;toast('Путевой камень установлен. B — расстояние, Shift+B — перенести.');}}
  if(!event.repeat&&code==='KeyB'&&event.shiftKey){active.waypoint=[...position];dirty=true;toast('Путевой камень перенесён');}
  if(!event.repeat&&code==='KeyF'&&creative()){flying=!flying;velocity=0;updateHUD();toast(flying?'Полёт включён':'Полёт выключен');}
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
    renderer.render(eye(),yaw,pitch,active.time,mobTarget?null:target,mobs.mobs,hotbar[selected]===13&&(creative()||active.inventory[13]>0));
    if(hudClock>.1){$('target').textContent=mobTarget?`${mobTarget.mob.type==='hostile'?'Ночной бродяга':mobTarget.mob.type==='sheep'?'Овца':'Олень'} · ♥ ${Math.ceil(mobTarget.mob.health)}`:target?BLOCKS[world.get(...target.cell)]?.name||'':'';$('coordinates').textContent=`${active.name} · X ${Math.floor(position[0])} Y ${Math.floor(position[1])} Z ${Math.floor(position[2])}`;updateHUD();hudClock=0;}
  }else if(now-lastRender>40){renderer.render(active?eye():[49,24,53],active?yaw:.65,active?pitch:-.38,active?.time??225,null,active?mobs.mobs:[]);lastRender=now;}
  if(saveClock>4){save();saveClock=0;}requestAnimationFrame(frame);
}
worldList();updateInventory();requestAnimationFrame(frame);
