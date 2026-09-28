(()=>{
  'use strict';
  const width=24,height=18,tileSize=32,storageKey='clock-attack-map-editor-v1';
  const catalog=window.ClockAttackTileCatalog||[];
  if(!catalog.length)throw Error('open-editor.cmdでチップ一覧を更新してください');
  const tileFiles=catalog.map(tile=>tile.image);
  const names=catalog.map(tile=>tile.file);

  function defaultMap(){
    const tiles=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const pathY=Math.round(height/2+Math.sin(x*.38)*2);
      const random=((x*73856093)^(y*19349663)^(x*y*83492791))>>>0;
      tiles.push(x>1&&x<width-2&&Math.abs(y-pathY)<=1?3:random%100<9?1:random%100<18?2:0);
    }
    return {version:1,width,height,tiles,objects:[],tileset:catalog};
  }

  function normalize(value){
    if(!value||value.version!==1||value.width!==width||value.height!==height||!Array.isArray(value.tiles)||value.tiles.length!==width*height)return null;
    const sourceNames=value.tileset?value.tileset.map(tile=>tile.file):['grass.png','grass-dark.png','flowers.png','soil.png'];
    if(!value.tiles.every(id=>Number.isInteger(id)&&id>=0&&id<sourceNames.length))return null;
    const translated=value.tiles.map(id=>names.indexOf(sourceNames[id]));
    if(translated.some(id=>id<0))return null;
    if(value.objects!==undefined&&!Array.isArray(value.objects))return null;
    const objects=[];
    for(const object of value.objects||[]){
      const id=names.indexOf(sourceNames[object.id]),tile=catalog[id];
      if(!tile||!Number.isInteger(object.x)||!Number.isInteger(object.y)||object.x<0||object.y<0||object.x+(tile.width_tiles||1)>width||object.y+(tile.height_tiles||1)>height)return null;
      objects.push({id,x:object.x,y:object.y});
    }
    return {version:1,width,height,tiles:translated,objects,tileset:catalog};
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

  window.ClockAttackMap={width,height,tileSize,names,tileFiles,catalog,defaultMap,normalize,load,save,drawTile};
})();
