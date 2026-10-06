(async()=>{
  'use strict';
  const canvas=document.getElementById('sample'),ctx=canvas.getContext('2d'),position=document.getElementById('position');
  const columns=64,rows=64,size=32,worldWidth=columns*size,worldHeight=rows*size;
  const player={x:worldWidth/2,y:worldHeight/2,angle:Math.PI/2},keys=new Set(),images=[],sprites=[];
  const zooms=[1,.75,.5];let zoomIndex=0,width=0,height=0,last=performance.now(),drag=null;
  const tiles=Array.from({length:columns*rows},(_,i)=>{const x=i%columns,y=Math.floor(i/columns),noise=((x*73856093)^(y*19349663))>>>0;return (Math.abs(x-32)<=1||Math.abs(y-32)<=1||x===8||y===8||x===55||y===55)?3:noise%100<14?1:noise%100<24?2:0});
  for(const file of ['grass','grass-dark','flowers','soil']){const image=new Image();image.src='maps/tiles/'+file+'.png';images.push(image)}
  const master=await fetch('game-data.json',{cache:'no-store'}).then(r=>r.json());
  const playerFiles=ClockAttackAssets.create(master.assets||[]).playerFiles();
  playerFiles.forEach((file,i)=>{if(!file)return;const image=new Image();image.onload=()=>{sprites[i]=image};image.src=file+'?player=1.32'});
  function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();
  const handled=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];
  addEventListener('keydown',event=>{if(!handled.includes(event.key))return;if(event.target.closest('button,a,input'))return;event.preventDefault();keys.add(event.key)});
  addEventListener('keyup',event=>keys.delete(event.key));addEventListener('blur',()=>{keys.clear();drag=null});
  canvas.addEventListener('pointerdown',event=>{if(drag)return;canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0}});
  canvas.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;drag.dx=event.clientX-drag.x;drag.dy=event.clientY-drag.y});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{if(drag?.id===event.pointerId)drag=null});
  document.getElementById('zoom').addEventListener('click',event=>{zoomIndex=(zoomIndex+1)%zooms.length;event.currentTarget.textContent='倍率'+Math.round(zooms[zoomIndex]*100)+'%'});
  document.getElementById('reset').addEventListener('click',()=>{player.x=worldWidth/2;player.y=worldHeight/2;drag=null;keys.clear()});
  function frame(now){
    const dt=Math.min((now-last)/1000,.05);last=now;
    let dx=Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a')),dy=Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'));
    if(drag){dx=drag.dx;dy=drag.dy;if(Math.hypot(dx,dy)<6){dx=0;dy=0}}
    const length=Math.hypot(dx,dy);if(length){player.angle=Math.atan2(dy,dx);const speed=240*(drag?Math.min(1,length/50):1);player.x=Math.max(32,Math.min(worldWidth-32,player.x+dx/length*speed*dt));player.y=Math.max(32,Math.min(worldHeight-32,player.y+dy/length*speed*dt))}
    const zoom=zooms[zoomIndex];ctx.fillStyle='#284a32';ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-player.x,-player.y);ctx.imageSmoothingEnabled=false;
    const left=Math.floor((player.x-width/(2*zoom))/size),right=Math.ceil((player.x+width/(2*zoom))/size),top=Math.floor((player.y-height/(2*zoom))/size),bottom=Math.ceil((player.y+height/(2*zoom))/size);
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const inside=x>=0&&x<columns&&y>=0&&y<rows,id=inside?tiles[y*columns+x]:0,image=images[id];ctx.globalAlpha=inside?1:.4;if(image.complete&&image.naturalWidth)ctx.drawImage(image,x*size,y*size,size,size);else{ctx.fillStyle=inside?'#518046':'#284a32';ctx.fillRect(x*size,y*size,size,size)}}
    ctx.globalAlpha=1;ctx.strokeStyle='#ffdf85';ctx.lineWidth=3/zoom;ctx.strokeRect(0,0,worldWidth,worldHeight);
    for(const [x,y,label] of [[1024,1024,'中央'],[288,288,'北西'],[1760,288,'北東'],[288,1760,'南西'],[1760,1760,'南東']]){ctx.fillStyle='#10241dcc';ctx.fillRect(x-29,y-64,58,26);ctx.fillStyle='#fff5da';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText(label,x,y-45)}
    ctx.fillStyle='#10241e88';ctx.beginPath();ctx.ellipse(player.x,player.y+23,17,6,0,0,Math.PI*2);ctx.fill();
    const direction=(Math.round((player.angle+Math.PI/2)/(Math.PI/4))+8)%8,sprite=sprites[direction];if(sprite){ctx.drawImage(sprite,player.x-sprite.naturalWidth/2,player.y-sprite.naturalHeight/2)}else{ctx.fillStyle='#ffe5a5';ctx.beginPath();ctx.arc(player.x,player.y,14,0,Math.PI*2);ctx.fill()}
    ctx.restore();position.textContent='位置 '+(player.x/size).toFixed(1)+', '+(player.y/size).toFixed(1)+' ／ プレイヤーは常に中央';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
