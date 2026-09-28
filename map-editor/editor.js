(()=>{
  'use strict';
  const tools=window.ClockAttackMap;
  const $=id=>document.getElementById(id);
  const canvas=$('map'),ctx=canvas.getContext('2d');
  const viewport=$('viewport'),message=$('message');
  const map=tools.load();
  const sheet=tools.tileFiles.map(()=>new Image());
  const buttons=[];
  const levels=[.4,.5,.75,1,1.25,1.5];
  const availableWidth=innerWidth-32;
  let zoomIndex=availableWidth>=tools.width*tools.tileSize?3:availableWidth>=tools.width*tools.tileSize*.75?2:availableWidth>=tools.width*tools.tileSize*.5?1:0;
  let selected=0,editing=false,drag=null,changed=false,brushLength=1,brushShape='line';
  const brushDirections={3:0,5:0,7:0},brushButtons=[];
  const directionNames=['横','縦','右下がり斜め','右上がり斜め'];

  let showEditorGrid=true,showEditorBounds=true;
  const overlay=$('mapOverlay'),overlayCtx=overlay.getContext('2d');
  function status(text){message.textContent=text}
  function setZoom(index){
    zoomIndex=Math.max(0,Math.min(levels.length-1,index));
    const zoom=levels[zoomIndex];
    canvas.style.width=`${canvas.width*zoom}px`;
    canvas.style.height=`${canvas.height*zoom}px`;
    overlay.style.width=canvas.style.width;overlay.style.height=canvas.style.height;
    viewport.style.height=`${Math.min(Math.round(innerHeight*.7),Math.round(canvas.height*zoom+16))}px`;
    $('zoomValue').textContent=`${Math.round(zoom*100)}%`;
    drawOverlay();
  }
  function drawCell(x,y){
    const size=tools.tileSize,left=x*size,top=y*size;
    ctx.fillStyle='#518046';ctx.fillRect(left,top,size,size);
    tools.drawTile(ctx,sheet,map.tiles[y*map.width+x],left,top);

  }
  function draw(){
    ctx.imageSmoothingEnabled=false;
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)drawCell(x,y);
    for(const object of map.objects||[]){
      const tile=tools.catalog[object.id],image=sheet[object.id];
      if(image.complete&&image.naturalWidth)ctx.drawImage(image,object.x*32,object.y*32,(tile.width_tiles||1)*32,(tile.height_tiles||1)*32);
    }
    drawOverlay();
  }
  function drawOverlay(){
    const cssWidth=Number($('battleWidth').value),cssHeight=Number($('battleHeight').value);
    const valid=Number.isFinite(cssWidth)&&Number.isFinite(cssHeight)&&cssWidth>=240&&cssWidth<=3840&&cssHeight>=320&&cssHeight<=2160;
    const w=cssWidth/BattleMapBounds.viewScale,h=cssHeight/BattleMapBounds.viewScale;
    const stageW=showEditorBounds&&valid?Math.max(canvas.width,Math.ceil(w)):canvas.width;
    const stageH=showEditorBounds&&valid?Math.max(canvas.height,Math.ceil(h)):canvas.height;
    const mapX=Math.round((stageW-canvas.width)/2),mapY=Math.round((stageH-canvas.height)/2),zoom=levels[zoomIndex];
    const layer=canvas.parentElement;layer.style.width=stageW*zoom+'px';layer.style.height=stageH*zoom+'px';
    canvas.style.position='absolute';canvas.style.left=mapX*zoom+'px';canvas.style.top=mapY*zoom+'px';
    overlay.width=stageW;overlay.height=stageH;overlay.style.width=stageW*zoom+'px';overlay.style.height=stageH*zoom+'px';
    if(showEditorGrid){
      overlayCtx.strokeStyle='#10211e88';overlayCtx.lineWidth=1;overlayCtx.beginPath();
      for(let x=0;x<=map.width;x++){overlayCtx.moveTo(mapX+x*32+.5,mapY);overlayCtx.lineTo(mapX+x*32+.5,mapY+canvas.height)}
      for(let y=0;y<=map.height;y++){overlayCtx.moveTo(mapX,mapY+y*32+.5);overlayCtx.lineTo(mapX+canvas.width,mapY+y*32+.5)}
      overlayCtx.stroke();
    }
    if(showEditorBounds&&valid){
      const rect=BattleMapBounds.outer(w,h),worldX=Math.round((stageW-w)/2),worldY=Math.round((stageH-h)/2);
      const x=rect.left+worldX,y=rect.top+worldY,width=rect.right-rect.left,height=rect.bottom-rect.top;
      overlayCtx.strokeStyle='#10211e';overlayCtx.lineWidth=5;overlayCtx.strokeRect(x,y,width,height);
      overlayCtx.strokeStyle='#fff2b6';overlayCtx.lineWidth=2;overlayCtx.strokeRect(x,y,width,height);
      overlayCtx.fillStyle='#10211ecc';overlayCtx.fillRect(x+5,y+5,170,24);
      overlayCtx.fillStyle='#fff2b6';overlayCtx.font='12px system-ui';overlayCtx.fillText('移動範囲 '+cssWidth+'×'+cssHeight,x+10,y+22);
    }
  }
  $('editorGridToggle').addEventListener('click',()=>{showEditorGrid=!showEditorGrid;$('editorGridToggle').textContent='グリッド：'+(showEditorGrid?'ON':'OFF');$('editorGridToggle').setAttribute('aria-pressed',String(showEditorGrid));drawOverlay()});
  $('editorBoundsToggle').addEventListener('click',()=>{showEditorBounds=!showEditorBounds;$('editorBoundsToggle').textContent='移動範囲：'+(showEditorBounds?'ON':'OFF');$('editorBoundsToggle').setAttribute('aria-pressed',String(showEditorBounds));drawOverlay()});
  for(const id of ['battleWidth','battleHeight'])$(id).addEventListener('input',drawOverlay);
  function drawPalette(){
    for(let id=0;id<buttons.length;id++){
      const preview=buttons[id].querySelector('canvas');
      const previewCtx=preview.getContext('2d');
      previewCtx.imageSmoothingEnabled=false;
      previewCtx.clearRect(0,0,64,64);
      const image=sheet[id];
      if(image.complete&&image.naturalWidth){const scale=Math.min(64/image.naturalWidth,64/image.naturalHeight);previewCtx.drawImage(image,(64-image.naturalWidth*scale)/2,(64-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale)};
    }
  }
  function updateToolUI(){
    buttons.forEach((button,index)=>button.classList.toggle('selected',index===selected));
    $('pan').classList.toggle('selected',!editing);
    $('pan').setAttribute('aria-pressed',String(!editing));
    $('edit').classList.toggle('selected',editing);
    $('edit').setAttribute('aria-pressed',String(editing));
    $('edit').textContent=editing?'編集中':'編集';
    updateBrushUI();
    canvas.style.cursor=editing?'crosshair':'grab';
    canvas.style.touchAction=editing?'none':'pan-y';
  }
  function setTool(id){
    selected=id;updateToolUI();
    status(`${tools.names[id]}を選択しました。${editing?'マップをタップして塗れます。':'塗るには「編集」を押してください。'}`);
  }
  function save(){
    if(tools.save(map)){changed=false;status('エディター内に保存しました。ゲームへの反映にはJSONを書き出してください。')}
    else status('保存できませんでした。書き出しでデータを残してください。');
  }
  function cellAt(event){
    const rect=canvas.getBoundingClientRect();
    const x=Math.floor((event.clientX-rect.left)/rect.width*map.width);
    const y=Math.floor((event.clientY-rect.top)/rect.height*map.height);
    return x>=0&&x<map.width&&y>=0&&y<map.height?{x,y}:null;
  }
  function paint(event){
    const cell=cellAt(event);if(!cell)return;
    const tile=tools.catalog[selected],tw=tile.width_tiles||1,th=tile.height_tiles||1;
    if(tw>1||th>1){
      if(cell.x+tw>map.width||cell.y+th>map.height){status('オブジェクトがマップ外にはみ出すため配置できません。');return}
      map.objects=map.objects||[];
      const overlaps=map.objects.filter(o=>{const t=tools.catalog[o.id];return cell.x<o.x+(t.width_tiles||1)&&cell.x+tw>o.x&&cell.y<o.y+(t.height_tiles||1)&&cell.y+th>o.y});
      if(overlaps.length){status('配置済みオブジェクトと重なっています。');return}
      map.objects.push({id:selected,x:cell.x,y:cell.y});changed=true;draw();status(tw+'×'+th+'マスのオブジェクトを配置しました。');return;
    }
    for(const point of MapBrush.cells(cell.x,cell.y,brushLength,brushDirections[brushLength]||0,map.width,map.height,brushShape)){
      const index=point.y*map.width+point.x;
      if(map.tiles[index]===selected)continue;
      map.tiles[index]=selected;changed=true;drawCell(point.x,point.y);
    }
    draw();
    status((brushShape==='square'?brushLength+'×'+brushLength:brushLength)+'マスで編集中');
  }
  function updateBrushUI(){
    for(const button of brushButtons){
      const length=Number(button.dataset.length),shape=button.dataset.shape,direction=brushDirections[length]||0;
      const active=editing&&brushLength===length&&brushShape===shape;
      const label=shape==='square'?length+'×'+length+'マス':length+'マス'+(length===1?'':'・'+directionNames[direction]);
      button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
      button.setAttribute('aria-label',label+'で描画');
      button.title=label+(shape==='line'&&length>1?'（もう一度押すと回転）':'');
      const [dx,dy]=MapBrush.directions[direction];let squares='';
      const offsets=shape==='square'?[-1,0,1].flatMap(y=>[-1,0,1].map(x=>[x,y])):(length===1?[[0,0]]:[[-dx,-dy],[0,0],[dx,dy]]);
      for(const [x,y] of offsets)squares+='<rect x="'+(18+x*12)+'" y="'+(18+y*12)+'" width="9" height="9" rx="1" fill="currentColor"/>';
      button.innerHTML='<svg viewBox="0 0 45 45" aria-hidden="true">'+squares+'</svg><span>'+(shape==='square'?length+'×'+length:length+'マス')+'</span>';
    }
  }
  for(const [length,shape] of [[1,'line'],[3,'line'],[5,'line'],[7,'line'],[3,'square'],[10,'square']]){
    const button=document.createElement('button');button.type='button';button.className='brush-button';button.dataset.length=length;button.dataset.shape=shape;
    button.addEventListener('click',()=>{
      if(editing&&brushLength===length&&brushShape===shape&&shape==='line'&&length>1)brushDirections[length]=(brushDirections[length]+1)%4;
      brushLength=length;brushShape=shape;editing=true;updateToolUI();
      status((shape==='square'?length+'×'+length:length)+'マスで描画します。クリック位置を中央に塗ります。');
    });
    brushButtons.push(button);$('brushes').append(button);
  }
  const brushHint=document.createElement('p');brushHint.className='brush-hint';brushHint.textContent='同じツールを押して向きを変更';$('brushes').append(brushHint);

  tools.names.forEach((name,id)=>{
    const button=document.createElement('button');
    button.className='tile-button';
    button.type='button';button.setAttribute('aria-label',`${name}を選択`);
    const preview=document.createElement('canvas');preview.width=64;preview.height=64;
    const label=document.createElement('span');label.textContent=name;
    const tile=tools.catalog[id];if((tile.width_tiles||1)>1||(tile.height_tiles||1)>1)label.textContent+=' ('+tile.width_tiles+'×'+tile.height_tiles+')';
    button.append(preview,label);
    button.addEventListener('click',()=>setTool(id));
    $('palette').append(button);buttons.push(button);
  });
  let loadedTiles=0;
  sheet.forEach((image,index)=>{
    image.onload=()=>{drawPalette();draw();if(++loadedTiles===sheet.length)status('移動中です。塗るには「編集」を押してください。')};
    image.onerror=()=>status('マップチップ画像を読み込めませんでした：'+tools.tileFiles[index]);
    image.src=tools.tileFiles[index];
  });
  setZoom(zoomIndex);
  updateToolUI();
  draw();

  canvas.addEventListener('pointerdown',event=>{
    if(editing)event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    if(editing)paint(event);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(editing)event.preventDefault();
    if(!editing){viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY}
    else paint(event);
  });
  function endDrag(event){
    if(!drag||drag.id!==event.pointerId)return;
    drag=null;if(changed)save();
  }
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',endDrag);
  $('pan').addEventListener('click',()=>{
    editing=false;updateToolUI();
    status('移動中です。塗るには「編集」を押してください。');
  });
  $('edit').addEventListener('click',()=>{
    editing=!editing;updateToolUI();
    status(editing?`${tools.names[selected]}で編集中です。マップをタップして塗れます。`:'移動中です。塗るには「編集」を押してください。');
  });
  $('zoomOut').addEventListener('click',()=>setZoom(zoomIndex-1));
  $('zoomIn').addEventListener('click',()=>setZoom(zoomIndex+1));
  $('save').addEventListener('click',save);
  $('export').addEventListener('click',()=>{
    const data=new Blob([JSON.stringify(map,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(data),link=document.createElement('a');
    link.href=url;link.download='clock-attack-grassland.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('JSONを書き出しました。ゲーム側のmapsフォルダへ同名で置き換えてください。');
  });
  $('import').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      const imported=tools.normalize(JSON.parse(await file.text()));
      if(!imported)throw Error('invalid map');
      map.tiles.splice(0,map.tiles.length,...imported.tiles);map.objects=imported.objects;
      draw();save();status('マップを読み込み、保存しました。');
    }catch{status('このマップデータは読み込めません。')}
    event.target.value='';
  });
})();
