import {createWorld,overlaps,cast,restoreSave,BLOCKS,HEIGHT,SIZE} from './world.js';
import {Renderer} from './renderer.js';
const $=id=>document.getElementById(id),canvas=$('world'),SAVE='cube-world-v1';
let renderer;try{renderer=new Renderer(canvas)}catch(e){$('unsupported').hidden=false;throw e}
let seed=Date.now()>>>0,world,position,yaw=0,pitch=-.12,velocity=0,grounded=false,playing=false,selected=0,found=new Set(),edits=new Map(),target=null,dirty=false,saveTimer=0,drag=null,toastTimer;
const keys=new Set(),palette=[1,2,3,4,5,6];
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600)}
function direction(){return [-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]}
function eye(){return [position[0],position[1]+1.5,position[2]]}
function progress(){const n=found.size;$('quest-progress').textContent=n===5?'Все кристаллы найдены. Теперь построй свой дом!':`Найди 5 кристаллов на острове · ${n} / 5`;$('quest-title').textContent=n===5?'Остров раскрыл свой секрет':'Секрет острова'}
function generate(){world=createWorld(seed);position=[...world.spawn];renderer.rebuild(world);progress()}
generate();
try{const raw=localStorage.getItem(SAVE);if(raw){const s=restoreSave(raw);seed=s.seed;world=createWorld(seed);edits=new Map(s.edits.map(e=>[e.slice(0,3).join(','),e]));found=new Set(s.found);for(const i of found)world.set(...world.crystals[i],0);for(const e of edits.values())world.set(...e);position=s.position;yaw=s.yaw;pitch=Math.max(-1.5,Math.min(1.5,s.pitch));if(overlaps(world,position)||position[1]<0||position[1]>HEIGHT+10)position=[...world.spawn];renderer.rebuild(world);progress();$('play').innerHTML='Продолжить приключение <span>↗</span>';$('world-info').textContent='Твой остров ждёт тебя.'}}catch(e){$('notice').textContent='Сохранение недоступно или повреждено. Открыт новый мир.'}
function save(){if(!dirty)return;try{localStorage.setItem(SAVE,JSON.stringify({version:1,seed,edits:[...edits.values()],position,yaw,pitch,found:[...found]}));dirty=false;$('save-status').textContent='✓ Мир сохранён'}catch(e){$('save-status').textContent='Не удалось сохранить';$('notice').textContent='Сохранение недоступно: проверь свободное место и настройки браузера.'}}
function select(n){selected=(n+6)%6;document.querySelectorAll('.slot').forEach((el,i)=>{el.classList.toggle('selected',i===selected);el.setAttribute('aria-pressed',String(i===selected))})}
palette.forEach((b,i)=>{const button=document.createElement('button');button.className='slot';button.setAttribute('aria-label',`${i+1}: ${BLOCKS[b].name}`);button.innerHTML=`<kbd>${i+1}</kbd><span class="block-icon" style="background:rgb(${BLOCKS[b].color.map(v=>v*255).join(',')})"></span><small>${BLOCKS[b].name}</small>`;button.onclick=()=>select(i);$('hotbar').append(button)});select(0);
function pause(){playing=false;keys.clear();drag=null;document.exitPointerLock?.();$('menu').hidden=false;$('hud').hidden=true;$('play').innerHTML='Вернуться на остров <span>↗</span>';save()}
async function play(){if(matchMedia('(pointer:coarse)').matches){$('notice').textContent='Эта версия рассчитана на клавиатуру и мышь. Открой игру на компьютере.';return}playing=true;$('menu').hidden=true;$('hud').hidden=false;try{await canvas.requestPointerLock?.()}catch(e){toast('Для обзора зажми мышь и потяни. E — добыть, Q — поставить.')}}
$('play').onclick=play;$('pause-button').onclick=()=>playing?pause():play();$('help-toggle').onclick=()=>{$('help').hidden=!$('help').hidden};
$('quality').onclick=()=>{renderer.quality=renderer.quality?0:1;$('quality').textContent=renderer.quality?'Графика: экономная':'Графика: авто'};
$('reset').onclick=()=>{if(!confirm('Создать новый остров? Текущая постройка и прогресс будут заменены.'))return;seed=(Math.random()*4294967296)>>>0;edits.clear();found.clear();yaw=0;pitch=-.12;velocity=0;generate();dirty=true;save();$('play').innerHTML='Открыть новый мир <span>↗</span>';$('world-info').textContent='Новый остров готов.'};
function interact(place=false){if(!playing||!target)return;const cell=place?target.previous:target.cell;const [x,y,z]=cell;if(y<1){toast('Основание острова нельзя разрушить');return}if(x<0||x>=SIZE||z<0||z>=SIZE||y>=HEIGHT){toast('Здесь проходит граница мира');return}
 if(place){if(world.get(...cell))return;const b=palette[selected];world.set(...cell,b);if(overlaps(world,position)){world.set(...cell,0);return}edits.set(cell.join(','),[...cell,b])}
 else{const b=world.get(...cell);if(b===7){const i=world.crystals.findIndex(c=>c.every((v,j)=>v===cell[j]));if(i>=0)found.add(i);toast(found.size===5?'Все 5 кристаллов твои! Остров благодарит тебя ✦':`Кристалл найден! ${found.size} / 5`);progress()}else edits.set(cell.join(','),[...cell,0]);world.set(...cell,0)}
 renderer.update(world,x,z);dirty=true;$('save-status').textContent='Сохраняем изменения…';target=cast(world,eye(),direction());
}
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLButtonElement&&['Enter','Space'].includes(e.code))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&playing)e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(playing)pause();return}if(!playing)return;keys.add(e.code);if(/^Digit[1-6]$/.test(e.code))select(Number(e.code.at(-1))-1);if(!e.repeat&&e.code==='KeyE')interact();if(!e.repeat&&e.code==='KeyQ')interact(true)});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(playing)pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause()});document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing&&!drag)pause()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('mousedown',e=>{if(!playing)return;if(document.pointerLockElement===canvas)interact(e.button===2);else drag={x:e.clientX,y:e.clientY,button:e.button,moved:false}});
document.addEventListener('mouseup',()=>{if(drag){if(!drag.moved)interact(drag.button===2);drag=null}});
document.addEventListener('mousemove',e=>{if(!playing)return;let dx=0,dy=0;if(document.pointerLockElement===canvas){dx=e.movementX;dy=e.movementY}else if(drag){dx=e.clientX-drag.x;dy=e.clientY-drag.y;drag.moved ||= Math.abs(dx)+Math.abs(dy)>2;drag.x=e.clientX;drag.y=e.clientY}else return;yaw-=dx*.0025;pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*.0025));dirty=true});
canvas.addEventListener('wheel',e=>{if(playing){e.preventDefault();select(selected+Math.sign(e.deltaY))}},{passive:false});window.addEventListener('pagehide',save);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('notice').textContent='3D-контекст потерян. Мир сохранён; обнови страницу.'});
function move(dt){const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?6:4)*dt/(Math.hypot(forward,right)||1);const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;
 for(const [axis,delta] of [[0,dx],[2,dz]]){position[axis]+=delta;if(overlaps(world,position))position[axis]-=delta}
 if(grounded&&keys.has('Space')){velocity=7.6;grounded=false}velocity-=22*dt;const steps=Math.max(1,Math.ceil(Math.abs(velocity*dt)/.15)),step=velocity*dt/steps;grounded=false;for(let i=0;i<steps;i++){position[1]+=step;if(overlaps(world,position)){position[1]-=step;if(velocity<0)grounded=true;velocity=0;break}}
 if(position[1]<-8){position=[...world.spawn];velocity=0;toast('Ты снова в центре острова')}
 if(dx||dz||velocity)dirty=true;
}
let previous=performance.now(),elapsed=0,hudTimer=0;
function frame(now){const dt=Math.min((now-previous)/1000,.04);previous=now;elapsed+=dt;saveTimer+=dt;hudTimer+=dt;
 if(playing){for(let i=0;i<3;i++)move(dt/3);target=cast(world,eye(),direction());renderer.render(eye(),yaw,pitch,elapsed,target);if(hudTimer>.15){$('target').textContent=target?BLOCKS[world.get(...target.cell)]?.name||'':'';$('coordinates').textContent=`X ${Math.floor(position[0])}  Y ${Math.floor(position[1])}  Z ${Math.floor(position[2])}`;hudTimer=0}}
 else renderer.render([49,24,53],.65,-.38,elapsed,null);
 if(saveTimer>4){save();saveTimer=0}requestAnimationFrame(frame)
}requestAnimationFrame(frame);
