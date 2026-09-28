(()=>{
  'use strict';
  const tools=window.ClockAttackMap;
  const $=id=>document.getElementById(id);
  const canvas=$('map'),ctx=canvas.getContext('2d');
  const viewport=$('viewport'),message=$('message');
  const map=tools.load();
  function syncSize(){canvas.width=map.width*32;canvas.height=map.height*32;document.querySelector(".board-bar strong").textContent=`マップ ${map.width} × ${map.height}`;$("mapWidth").value=map.width;$("mapHeight").value=map.height;}
  syncSize();
  const sheet=tools.tileFiles.map(()=>new Image());
  const buttons=[];
  const levels=[.4,.5,.75,1,1.25,1.5];
  const availableWidth=innerWidth-32;
  let zoomIndex=availableWidth>=tools.width*tools.tileSize?3:availableWidth>=tools.width*tools.tileSize*.75?2:availableWidth>=tools.width*tools.tileSize*.5?1:0;
  let selected=0,editing=false,erasingObjects=false,drag=null,changed=false,brushLength=1,brushShape='line';
  const brushDirections={3:0,5:0,7:0},brushButtons=[];
  const directionNames=['横','縦','右下がり斜め','右上がり斜め'];
  const isObjectTile=tile=>tile.category==='object'||(tile.width_tiles||1)>1||(tile.height_tiles||1)>1;
  let placingPlayer=false,previewPlayer=null,previewSprite=null;
  const previewImage=new Image();
  previewImage.onload=()=>{
    const sprite=document.createElement('canvas');sprite.width=513;sprite.height=629;
    const context=sprite.getContext('2d',{willReadFrequently:true});context.drawImage(previewImage,370,334,513,629,0,0,513,629);
    const pixels=context.getImageData(0,0,513,629);
    for(let i=0;i<pixels.data.length;i+=4)if(Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2])<=2)pixels.data[i+3]=0;
    context.putImageData(pixels,0,0);previewSprite=sprite;drawOverlay();
  };
  previewImage.src=window.ClockAttackPlayerPreview;

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
    const center=previewPlayer||{x:canvas.width/2,y:canvas.height/2};
    const camera={left:center.x-w/2,top:center.y-h/2,width:w,height:h};
    const mapX=showEditorBounds&&valid?Math.ceil(Math.max(0,-camera.left)):0;
    const mapY=showEditorBounds&&valid?Math.ceil(Math.max(0,-camera.top)):0;
    const stageW=showEditorBounds&&valid?Math.ceil(mapX+Math.max(canvas.width,camera.left+w)):canvas.width;
    const stageH=showEditorBounds&&valid?Math.ceil(mapY+Math.max(canvas.height,camera.top+h)):canvas.height;
    const zoom=levels[zoomIndex];
    const layer=canvas.parentElement;layer.style.width=stageW*zoom+'px';layer.style.height=stageH*zoom+'px';
    canvas.style.position='absolute';canvas.style.left=mapX*zoom+'px';canvas.style.top=mapY*zoom+'px';
    overlay.width=stageW;overlay.height=stageH;overlay.style.width=stageW*zoom+'px';overlay.style.height=stageH*zoom+'px';
    if(showEditorGrid){
      overlayCtx.strokeStyle='#10211e88';overlayCtx.lineWidth=1;overlayCtx.beginPath();
      for(let x=0;x<=map.width;x++){overlayCtx.moveTo(mapX+x*32+.5,mapY);overlayCtx.lineTo(mapX+x*32+.5,mapY+canvas.height)}
      for(let y=0;y<=map.height;y++){overlayCtx.moveTo(mapX,mapY+y*32+.5);overlayCtx.lineTo(mapX+canvas.width,mapY+y*32+.5)}
      overlayCtx.stroke();
    }
    overlayCtx.strokeStyle='#b2d0bc';overlayCtx.lineWidth=2;
    overlayCtx.strokeRect(mapX+1,mapY+1,canvas.width-2,canvas.height-2);
    if(showEditorBounds&&valid){
      const x=mapX+camera.left,y=mapY+camera.top,width=camera.width,height=camera.height;
      overlayCtx.strokeStyle='#10211e';overlayCtx.lineWidth=5;overlayCtx.strokeRect(x,y,width,height);
      overlayCtx.strokeStyle='#fff2b6';overlayCtx.lineWidth=2;overlayCtx.strokeRect(x,y,width,height);
      overlayCtx.fillStyle='#10211ecc';overlayCtx.fillRect(x+5,y+5,240,24);
      overlayCtx.fillStyle='#fff2b6';overlayCtx.font='12px system-ui';overlayCtx.fillText('カメラ表示範囲 '+cssWidth+'×'+cssHeight,x+10,y+22);
    }
    if(placingPlayer||previewPlayer){
      overlayCtx.strokeStyle='#ff7070';overlayCtx.lineWidth=2;
      for(const rect of MapCollision.build(map,tools.catalog))overlayCtx.strokeRect(mapX+rect.left,mapY+rect.top,rect.right-rect.left,rect.bottom-rect.top);
    }
    if(previewPlayer&&previewSprite){
      const height=56*(window.ClockAttackPreviewScale||1),width=height*previewSprite.width/previewSprite.height;
      overlayCtx.imageSmoothingEnabled=false;overlayCtx.drawImage(previewSprite,mapX+previewPlayer.x-width/2,mapY+previewPlayer.y+21-height,width,height);
    }
  }
  $('editorGridToggle').addEventListener('click',()=>{showEditorGrid=!showEditorGrid;$('editorGridToggle').textContent='グリッド：'+(showEditorGrid?'ON':'OFF');$('editorGridToggle').setAttribute('aria-pressed',String(showEditorGrid));drawOverlay()});
  $('editorBoundsToggle').addEventListener('click',()=>{showEditorBounds=!showEditorBounds;$('editorBoundsToggle').textContent='カメラ表示範囲：'+(showEditorBounds?'ON':'OFF');$('editorBoundsToggle').setAttribute('aria-pressed',String(showEditorBounds));drawOverlay()});
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
    $('eraseObjects').classList.toggle('selected',editing&&erasingObjects);
    $('eraseObjects').setAttribute('aria-pressed',String(editing&&erasingObjects));
    $('placePlayer').classList.toggle('selected',placingPlayer);
    $('placePlayer').setAttribute('aria-pressed',String(placingPlayer));
    updateBrushUI();
    canvas.style.cursor=editing?'crosshair':'grab';
    canvas.style.touchAction=editing?'none':'pan-y';
  }
  function setTool(id){
    selected=id;erasingObjects=false;placingPlayer=false;updateToolUI();
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
    if(placingPlayer){
      previewPlayer={x:cell.x*32+16,y:cell.y*32+16};drawOverlay();
      const blocked=MapCollision.blocked(previewPlayer.x,previewPlayer.y+14,10,MapCollision.build(map,tools.catalog));
      status(blocked?'プレイヤーを配置しました。足元が通行不可の範囲に重なっています。':'確認用プレイヤーを配置しました。別のマスを押すと置き直せます。');return;
    }
    if(erasingObjects){
      const objects=map.objects||[];
      const index=objects.findIndex(object=>{
        const tile=tools.catalog[object.id];
        return cell.x>=object.x&&cell.x<object.x+(tile.width_tiles||1)&&cell.y>=object.y&&cell.y<object.y+(tile.height_tiles||1);
      });
      if(index<0)return;
      objects.splice(index,1);changed=true;draw();status('オブジェクトを削除しました。地面のチップは残ります。');return;
    }
    const tile=tools.catalog[selected],tw=tile.width_tiles||1,th=tile.height_tiles||1;
    if(isObjectTile(tile)){
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
      const active=editing&&!erasingObjects&&!placingPlayer&&brushLength===length&&brushShape===shape;
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
      brushLength=length;brushShape=shape;editing=true;placingPlayer=false;erasingObjects=false;updateToolUI();
      status((shape==='square'?length+'×'+length:length)+'マスで描画します。クリック位置を中央に塗ります。');
    });
    brushButtons.push(button);$('brushes').append(button);
  }
  const brushHint=document.createElement('p');brushHint.className='brush-hint';brushHint.textContent='同じツールを押して向きを変更';$('brushes').append(brushHint);
  const eraser=document.createElement('button');eraser.type='button';eraser.id='eraseObjects';eraser.className='brush-button';eraser.setAttribute('aria-label','オブジェクト消しゴム');eraser.title='タップしたオブジェクトを削除します。地面は残ります。';eraser.innerHTML='<svg viewBox="0 0 45 45" aria-hidden="true"><path d="M8 27 24 10a4 4 0 0 1 6 0l8 8a4 4 0 0 1 0 6L22 40H13L8 35a6 6 0 0 1 0-8Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m17 18 14 14M22 40h16" fill="none" stroke="currentColor" stroke-width="3"/></svg><span>オブジェクト消しゴム</span>';
  eraser.addEventListener('click',()=>{erasingObjects=true;placingPlayer=false;editing=true;updateToolUI();status('消したいオブジェクトをタップしてください。地面のチップは残ります。')});
  $('brushes').append(eraser);
  const playerTool=document.createElement('button');playerTool.type='button';playerTool.id='placePlayer';playerTool.className='brush-button';playerTool.textContent='プレイヤー配置';
  playerTool.addEventListener('click',()=>{placingPlayer=!placingPlayer;erasingObjects=false;editing=true;if(!placingPlayer)previewPlayer=null;updateToolUI();drawOverlay();status(placingPlayer?'マップを押して確認用プレイヤーを配置してください。もう一度ボタンを押すと非表示になります。':'確認用プレイヤーを非表示にしました。')});$('brushes').append(playerTool);

  let previousCategory='';
  tools.names.forEach((name,id)=>{
    const tile=tools.catalog[id],category=isObjectTile(tile)?'object':'ground';
    if(category!==previousCategory){
      const heading=document.createElement('div');heading.className='palette-heading '+category+'-heading';heading.textContent=category==='object'?'オブジェクト':'地面チップ';$('palette').append(heading);previousCategory=category;
    }
    const button=document.createElement('button');
    button.className='tile-button '+(category==='object'?'object-tile':'ground-tile');
    if(/^#[0-9a-fA-F]{6}$/.test(tile.palette_color||''))button.style.backgroundColor=tile.palette_color;
    button.type='button';button.setAttribute('aria-label',`${name}を選択`);
    const preview=document.createElement('canvas');preview.width=64;preview.height=64;
    const label=document.createElement('span');label.textContent=name;
    if((tile.width_tiles||1)>1||(tile.height_tiles||1)>1)label.textContent+=' ('+tile.width_tiles+'×'+tile.height_tiles+')';
    button.append(preview,label);
    if(tile.palette_category){
      const badge=document.createElement('small');badge.className='palette-category';badge.textContent=tile.palette_category;button.append(badge);
    }
    button.addEventListener('click',()=>{
      setTool(id);
      if(category==='object'){
        editing=true;updateToolUI();
        status(`${name}を配置します。マップをタップしてください。`);
      }
    });
    $('palette').append(button);buttons.push(button);
  });
  let loadedTiles=0;
  sheet.forEach((image,index)=>{
    image.onload=()=>{drawPalette();draw();if(++loadedTiles===sheet.length)status('移動中です。塗るには「編集」を押してください。')};
    image.onerror=()=>status('マップチップ画像を読み込めませんでした：'+tools.tileFiles[index]);
    image.src=tools.tileFiles[index];
  });
  $('resizeMap').addEventListener('click',()=>{
    const width=Number($('mapWidth').value),height=Number($('mapHeight').value);
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||height<4||width>256||height>256){status('縦横4〜256マスの整数を指定してください。');return}
    if(width===map.width&&height===map.height)return;
    const kept=(map.objects||[]).filter(o=>o.x+(tools.catalog[o.id].width_tiles||1)<=width&&o.y+(tools.catalog[o.id].height_tiles||1)<=height);
    if((width<map.width||height<map.height)&&!confirm('サイズを小さくすると、範囲外の地形とオブジェクトが削除されます。変更しますか？'))return;
    const tiles=Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width);return x<map.width&&y<map.height?map.tiles[y*map.width+x]:0});
    map.width=width;map.height=height;map.tiles=tiles;map.objects=kept;
    if(previewPlayer&&(previewPlayer.x>=width*32||previewPlayer.y>=height*32))previewPlayer=null;
    syncSize();setZoom(zoomIndex);draw();save();status('サイズを変更して保存しました。追加した部分は先頭の地面チップで埋めています。');
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
    status(editing?(erasingObjects?'消したいオブジェクトをタップしてください。':`${tools.names[selected]}で編集中です。マップをタップして塗れます。`):'移動中です。塗るには「編集」を押してください。');
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
      map.width=imported.width;map.height=imported.height;map.tiles=imported.tiles;map.objects=imported.objects;previewPlayer=null;syncSize();setZoom(zoomIndex);
      draw();save();status('マップを読み込み、保存しました。');
    }catch{status('このマップデータは読み込めません。')}
    event.target.value='';
  });
})();
