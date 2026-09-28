(()=>{
  'use strict';
  const width=24,height=18,tileSize=32,storageKey='clock-attack-grassland-v1';
  let names=['草','濃い草','花','土'];
  let tileFiles=['grass','grass-dark','flowers','soil'].map(name=>`maps/tiles/${name}.png`);

  function configureTiles(tileset){
    if(!Array.isArray(tileset)||!tileset.length||tileset.some(tile=>!tile||typeof tile.file!=='string'||typeof tile.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(tile.image)))return false;
    if(new Set(tileset.map(tile=>tile.file)).size!==tileset.length)return false;
    tileFiles=tileset.map(tile=>tile.image);names=tileset.map(tile=>tile.file);
    window.ClockAttackMap.tileFiles=tileFiles;window.ClockAttackMap.names=names;
    return true;
  }

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

  function drawTile(ctx,images,id,x,y,size=tileSize){
    const image=images[id];
    if(!image||!image.complete||!image.naturalWidth)return;
    ctx.drawImage(image,x,y,size,size);
  }

  window.ClockAttackMap={width,height,tileSize,names,tileFiles,configureTiles,defaultMap,normalize,load,save,drawTile};
})();
