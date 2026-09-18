(()=>{
  'use strict';
  const width=24,height=18,tileSize=32,storageKey='clock-attack-grassland-v1';
  const names=['草','濃い草','花','土'];
  const tileSheet='maps/grassland-tiles.png';

  function defaultMap(){
    const tiles=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const pathY=Math.round(height/2+Math.sin(x*.38)*2);
      const random=((x*73856093)^(y*19349663)^(x*y*83492791))>>>0;
      tiles.push(x>1&&x<width-2&&Math.abs(y-pathY)<=1?3:random%100<9?1:random%100<18?2:0);
    }
    return {version:1,width,height,tiles};
  }

  function normalize(value){
    if(!value||value.version!==1||value.width!==width||value.height!==height||!Array.isArray(value.tiles)||value.tiles.length!==width*height)return null;
    if(!value.tiles.every(id=>Number.isInteger(id)&&id>=0&&id<names.length))return null;
    return {version:1,width,height,tiles:value.tiles.slice()};
  }

  function load(){
    try{
      const saved=localStorage.getItem(storageKey);
      return saved?normalize(JSON.parse(saved))||defaultMap():defaultMap();
    }catch{return defaultMap()}
  }

  function save(map){
    const valid=normalize(map);
    if(!valid)return false;
    try{localStorage.setItem(storageKey,JSON.stringify(valid));return true}catch{return false}
  }

  function drawTile(ctx,image,id,x,y,size=tileSize){
    if(!image.complete||!image.naturalWidth)return;
    const quadrant=Math.floor(Math.min(image.width,image.height)/2);
    const crop=Math.floor(quadrant*.34);
    const offsets=[[.18,.18],[.15,.15],[.02,.02],[.16,.16]];
    const [ox,oy]=offsets[id]||offsets[0];
    const sx=(id%2)*quadrant+Math.floor(quadrant*ox);
    const sy=Math.floor(id/2)*quadrant+Math.floor(quadrant*oy);
    ctx.drawImage(image,sx,sy,crop,crop,x,y,size,size);
  }

  window.ClockAttackMap={width,height,tileSize,names,tileSheet,defaultMap,normalize,load,save,drawTile};
})();
