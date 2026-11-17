export function tickVitals(player,dt,{sprinting=false,moving=false,underwater=false}={}){
 const before=[player.health,player.hunger];let damage=0;
 player.hunger=Math.max(0,(player.hunger??20)-dt*(moving?(sprinting?.045:.018):.008));
 player.vitalClock=(player.vitalClock||0)+dt;
 while(player.vitalClock>=4){player.vitalClock-=4;if(player.hunger>=16&&player.health<20){player.health=Math.min(20,player.health+1);player.hunger=Math.max(0,player.hunger-.4);}else if(player.hunger===0&&player.health>1){damage++;}}
 return {changed:before[0]!==player.health||before[1]!==player.hunger,damage};
}
export function eat(player){if(!(player.food>0)||(player.hunger??20)>=20)return false;player.food--;player.hunger=Math.min(20,(player.hunger??20)+6);return true;}
export function dayLight(time){const sun=Math.sin((time%900)/900*Math.PI*2);return {day:Math.max(.06,Math.min(1,sun*1.3+.2)),night:sun<-.15,phase:((time%900)+900)%900/900,sun};}
