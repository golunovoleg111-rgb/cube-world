// Original deterministic pixel art. No external artwork or network requests.
export function atlasPixels(size=16){
 const width=size*4,data=new Uint8Array(width*width*4);
 const colors=[[89,142,51],[111,88,51],[115,80,49],[125,135,133],[119,83,43],[156,115,65],[54,112,53],[211,196,137],[86,211,205],[47,135,166],[177,132,76],[161,86,65],[224,238,241],[170,92,56],[102,108,106],[244,171,52]];
 const noise=(x,y,t)=>{let n=Math.imul(x+1,374761393)^Math.imul(y+9,668265263)^Math.imul(t+3,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296};
 for(let t=0;t<16;t++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
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
  const i=((Math.floor(t/4)*size+y)*width+(t%4)*size+x)*4;
  for(let k=0;k<3;k++)data[i+k]=Math.min(255,c[k]*f);data[i+3]=255;
 }
 return {data,width};
}
