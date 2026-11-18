// Original deterministic pixel art. No external artwork or network requests.
export function atlasPixels(size=16){
 const width=size*8,data=new Uint8Array(width*width*4);
 const colors=[[89,142,51],[111,88,51],[115,80,49],[125,135,133],[119,83,43],[156,115,65],[54,112,53],[211,196,137],[86,211,205],[47,135,166],[177,132,76],[161,86,65],[224,238,241],[170,92,56],[102,108,106],[244,171,52]];
 const noise=(x,y,t)=>{let n=Math.imul(x+1,374761393)^Math.imul(y+9,668265263)^Math.imul(t+3,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296};
 const extra=[[173,219,232],[153,107,59],[155,96,39],[107,113,116],[183,47,46],[224,218,195],[186,155,103],[132,173,68],[79,62,44],[134,107,68],[46,91,64],[203,183,127],[112,120,116],[137,142,142],[139,121,110],[193,205,211],[146,105,59],[248,210,107],[210,71,82],[141,101,62],[115,75,44],[205,159,123],[49,104,137],[46,58,83],[143,84,47],[57,176,182],[188,199,204],[130,92,53],[211,194,139],[107,83,54],[228,230,215],[174,77,68],[215,117,40]];
 colors.push(...extra);
 for(let t=0;t<64;t++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let c=[...(colors[t]||[255,255,255])],f=.88+noise(x,y,t)*.24;
  if(t===1&&y>size*(.68-noise(x,0,t)*.16))c=colors[0];
  if(t===3){if((x+Math.floor(y/5)*3)%13===0||y%11===0)f*=.72;}
  if(t===4)f*=.8+.25*Math.sin(x*1.7+Math.sin(y*.4));
  if(t===5){const r=Math.hypot(x-size/2,y-size/2);f*=.85+.18*Math.sin(r*2);}
  if(t===6)f*=noise(Math.floor(x/3),Math.floor(y/3),t)>.45?1.12:.73;
  if(t===7&&noise(x,y,t)>.94)c=[240,228,175];
  if(t===8){f*=.8+(x+y)/size*.28;if(Math.abs(x-size*.4)<1||Math.abs(y-size*.4)<1)f*=1.2;}
  if(t===9)f=.9+.1*Math.sin(x*.75+y*.8)+(noise(x,y,t)-.5)*.13;
  if(t===10){if(y%Math.max(4,size/4)===0)f*=.57;else f*=.92+.08*Math.sin(x*.9);}
  if(t===11){const row=Math.floor(y/(size/4));if(y%(size/4)<1||(x+row*(size/4))%(size/2)<1)c=[194,184,157];}
  if(t===12)f=.94+noise(x,y,t)*.09;
  if(t===13)f*=.8+.2*Math.sin(y*.8);
  if(t===14&&noise(Math.floor(x/3),Math.floor(y/3),t)>.6)c=[35,38,36];
  if(t===15){c=y>size*.6?[255,215,88]:[137,93,45];f=1;}
  if(t===16){f=1;if(x<2||y<2||x>size-3||y>size-3)c=[171,211,221];else if(Math.abs(x-y-5)<2)c=[212,242,250];}
  if(t===17){if(x<2||x>size-3||y<2||y>size-3||y===Math.floor(size/2))f*=.55;if(x>size*.72&&y>size*.42&&y<size*.55)c=[224,191,93];}
  if(t===18){if(y<2||y>size-3||y===Math.floor(size*.7))f*=.45;if(x>size*.44&&x<size*.56&&y>size*.4&&y<size*.64)c=[218,187,100];}
  if(t===19||t===48){if(x>size*.2&&x<size*.8&&y>size*.22&&y<size*.5)c=t===48?[240,132,34]:[31,34,36];if(y>size*.75&&y<size*.83&&x>size*.2&&x<size*.8)c=[50,52,53];}
  if(t===21){if(noise(Math.floor(x/3),Math.floor(y/2),t)>.8)c=[54,53,45];}
  if(t===22||t===25){f*=.85+.15*Math.sin(Math.hypot(x-size/2,y-size/2)*2);}
  if(t===23||t===26)f*=noise(Math.floor(x/3),Math.floor(y/3),t)>.45?1.1:.8;
  if(t===24)f*=.8+.2*Math.sin(x*1.3);
  if(t===27||t===29){if(y%(size/4)<1||(x+Math.floor(y/(size/4))*(size/4))%(size/2)<1)f*=.55;}
  if(t===28&&noise(Math.floor(x/5),Math.floor(y/5),t)>.6)f*=.7;
  if(t===30&&noise(Math.floor(x/3),Math.floor(y/3),t)>.55)c=[194,151,113];
  if(t===31){if(x<2||y<2||x>size-3||y>size-3)f*=.65;else f=.9+.15*y/size;}
  if(t===32&&(x%(size/4)<1||y%(size/4)<1))f*=.45;
  if(t===33){if(x<3||x>size-4||y<3||y>size-4)c=[74,72,51];else c=[255,220,118];}
  if(t===36){if(y%(size/3)<2)c=[82,56,35];else c=x%(size/4)<size/8?[72,124,99]:[161,63,60];}
  if(t===44||t===45){if(y%(size/4)<1)f*=.65;}
  const i=((Math.floor(t/8)*size+y)*width+(t%8)*size+x)*4;
  for(let k=0;k<3;k++)data[i+k]=Math.min(255,c[k]*f);data[i+3]=t===16?(x<2||y<2||x>size-3||y>size-3?180:55):255;
 }
 return {data,width};
}
