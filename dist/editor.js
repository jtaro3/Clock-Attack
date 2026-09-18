(()=>{
  'use strict';
  const tools=window.ClockAttackMap;
  const $=id=>document.getElementById(id);
  const canvas=$('map'),ctx=canvas.getContext('2d');
  const viewport=$('viewport'),message=$('message');
  const map=tools.load();
  const sheet=new Image();
  const buttons=[];
  const levels=[.5,.75,1,1.25,1.5];
  let zoomIndex=innerWidth>=tools.width*tools.tileSize+260?2:innerWidth>=tools.width*tools.tileSize*.75+32?1:0;
  let selected=0,pan=false,drag=null,changed=false;

  function status(text){message.textContent=text}
  function setZoom(index){
    zoomIndex=Math.max(0,Math.min(levels.length-1,index));
    const zoom=levels[zoomIndex];
    canvas.style.width=`${canvas.width*zoom}px`;
    canvas.style.height=`${canvas.height*zoom}px`;
    viewport.style.height=`${Math.min(Math.round(innerHeight*.7),Math.round(canvas.height*zoom+16))}px`;
    $('zoomValue').textContent=`${Math.round(zoom*100)}%`;
  }
  function drawCell(x,y){
    const size=tools.tileSize,left=x*size,top=y*size;
    ctx.fillStyle='#518046';ctx.fillRect(left,top,size,size);
    tools.drawTile(ctx,sheet,map.tiles[y*map.width+x],left,top);
    ctx.strokeStyle='#122a254d';ctx.lineWidth=1;
    ctx.strokeRect(left+.5,top+.5,size,size);
  }
  function draw(){
    ctx.imageSmoothingEnabled=false;
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)drawCell(x,y);
  }
  function drawPalette(){
    for(let id=0;id<buttons.length;id++){
      const preview=buttons[id].querySelector('canvas');
      const previewCtx=preview.getContext('2d');
      previewCtx.imageSmoothingEnabled=false;
      previewCtx.fillStyle='#518046';previewCtx.fillRect(0,0,32,32);
      tools.drawTile(previewCtx,sheet,id,0,0);
    }
  }
  function setTool(id){
    selected=id;pan=false;
    buttons.forEach((button,index)=>button.classList.toggle('selected',index===id));
    $('pan').classList.remove('selected');
    canvas.style.cursor='crosshair';
  }
  function save(){
    if(tools.save(map)){changed=false;status('保存しました。ゲームに戻ると反映されます。')}
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
    const index=cell.y*map.width+cell.x;
    if(map.tiles[index]===selected)return;
    map.tiles[index]=selected;changed=true;
    drawCell(cell.x,cell.y);
    status('編集中');
  }

  tools.names.forEach((name,id)=>{
    const button=document.createElement('button');
    button.className='tile-button'+(id===0?' selected':'');
    button.type='button';button.setAttribute('aria-label',`${name}を選択`);
    const preview=document.createElement('canvas');preview.width=32;preview.height=32;
    const label=document.createElement('span');label.textContent=name;
    button.append(preview,label);
    button.addEventListener('click',()=>setTool(id));
    $('palette').append(button);buttons.push(button);
  });
  sheet.onload=()=>{drawPalette();draw();status('チップを選んで塗ってください。')};
  sheet.onerror=()=>status('マップチップ画像を読み込めませんでした。');
  sheet.src=tools.tileSheet;
  setZoom(zoomIndex);
  draw();

  canvas.addEventListener('pointerdown',event=>{
    event.preventDefault();canvas.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    if(!pan)paint(event);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    event.preventDefault();
    if(pan){viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY}
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
    pan=!pan;$('pan').classList.toggle('selected',pan);
    canvas.style.cursor=pan?'grab':'crosshair';
    if(pan)buttons.forEach(button=>button.classList.remove('selected'));
    else buttons[selected].classList.add('selected');
  });
  $('zoomOut').addEventListener('click',()=>setZoom(zoomIndex-1));
  $('zoomIn').addEventListener('click',()=>setZoom(zoomIndex+1));
  $('save').addEventListener('click',save);
  $('export').addEventListener('click',()=>{
    const data=new Blob([JSON.stringify(map,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(data),link=document.createElement('a');
    link.href=url;link.download='clock-attack-grassland.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('マップデータを書き出しました。');
  });
  $('import').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      const imported=tools.normalize(JSON.parse(await file.text()));
      if(!imported)throw Error('invalid map');
      map.tiles.splice(0,map.tiles.length,...imported.tiles);
      draw();save();status('マップを読み込み、保存しました。');
    }catch{status('このマップデータは読み込めません。')}
    event.target.value='';
  });
})();
