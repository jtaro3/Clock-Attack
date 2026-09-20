(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const canvas=$('field'),ctx=canvas.getContext('2d');
  const ui={overlay:$('overlay'),panel:$('panel'),title:$('title'),eyebrow:$('eyebrow'),description:$('description'),resultValue:$('resultValue'),hourHand:$('hourHand'),minuteHand:$('minuteHand'),stop:$('stop'),debug:$('debug'),sub:$('sub'),score:$('score'),roundNumber:$('roundNumber'),roundTarget:$('roundTarget'),elapsedTime:$('elapsedTime'),energyValue:$('energyValue'),energyFill:$('energyFill'),grayDamageFill:$('grayDamageFill'),energyBar:document.querySelector('.energy-bar'),attackCount:$('attackCount'),clockCount:$('clockCount'),clockButton:$('clockButton'),clockStock:$('clockStock'),buttonHourglass:$('buttonHourglass'),sandPreview:$('sandPreview'),previewSandCount:$('previewSandCount'),previewHourglass:$('previewHourglass'),killWarning:$('killWarning'),killCountdown:$('killCountdown'),attack:$('attack'),pauseButton:$('pauseButton'),pauseScreen:$('pauseScreen'),resumeButton:$('resumeButton')};
  const player={x:0,y:0,r:14,angle:-Math.PI/2};
  // 上から時計回り: 背面、背面右、右、正面右、正面、正面左、左、背面左。
  const spriteBounds=[[386,362,850,928],[396,376,846,930],[432,356,812,956],[396,344,836,952],[386,350,866,946],[374,340,862,916],[394,344,828,926],[396,324,828,922]];
  const playerSprites=Array(8).fill(null);
  const playerSpritesGray=Array(8).fill(null);
  spriteBounds.forEach(([left,top,right,bottom],i)=>{
    const image=new Image();
    image.onload=()=>{
      const margin=16,x=left-margin,y=top-margin;
      const sprite=document.createElement('canvas');
      sprite.width=right-left+margin*2+1;sprite.height=bottom-top+margin*2+1;
      const spriteContext=sprite.getContext('2d',{willReadFrequently:true});
      spriteContext.drawImage(image,x,y,sprite.width,sprite.height,0,0,sprite.width,sprite.height);
      const pixels=spriteContext.getImageData(0,0,sprite.width,sprite.height);
      for(let p=0;p<pixels.data.length;p+=4){
        // 元画像の黒い背景（RGB 0〜2）だけを透明にする。
        if(Math.max(pixels.data[p],pixels.data[p+1],pixels.data[p+2])<=2)pixels.data[p+3]=0;
      }
      spriteContext.putImageData(pixels,0,0);
      // 灰色版を画像データから作る。スマホの Canvas filter 対応に依存しない。
      const gray=document.createElement('canvas');gray.width=sprite.width;gray.height=sprite.height;
      const grayContext=gray.getContext('2d');
      const grayPixels=grayContext.createImageData(gray.width,gray.height);
      grayPixels.data.set(pixels.data);
      for(let p=0;p<grayPixels.data.length;p+=4){
        if(grayPixels.data[p+3]===0)continue;
        const shade=Math.round(grayPixels.data[p]*.2126+grayPixels.data[p+1]*.7152+grayPixels.data[p+2]*.0722);
        grayPixels.data[p]=shade;grayPixels.data[p+1]=shade;grayPixels.data[p+2]=shade;
      }
      grayContext.putImageData(grayPixels,0,0);
      playerSprites[i]=sprite;
      playerSpritesGray[i]=gray;
      image.onload=null;
    };
    image.src=`design/man${i+1}.png`;
  });
  const swordImage=new Image();
  swordImage.src='design/sword.svg';
  const VIEW_SCALE=.8;
  const mapTools=window.ClockAttackMap,map=mapTools.load();
  const tileImage=new Image();
  let terrainCanvas=null;
  tileImage.onload=()=>renderTerrain();
  tileImage.src=mapTools.tileSheet;
  const enemies=[],deadEnemies=[],particles=[],explosions=[],damageNumbers=[];
  const drag={pointer:null,x:0,y:0};
  const charge={pointer:null,start:0,timer:null};
  const keys=new Set();
  let w=0,h=0,dpr=1,last=performance.now(),clockOrigin=last-61/1440*3000;
  let mode='select',selectionReason='start',selectionIcons=0,selectionKills=0,transitionTimer=null;
  let energy=0,moveProgress=0,unlocked=0,score=0,round=1,roundKills=0,roundSpawned=0,swordCount=0,elapsed=0,timeSinceKill=0,purpleSpawned=false,spawnTimer=0,invincible=0,damageFlash=0,grayHits=0,entryGray=0,lowEnergyGray=false,swing=0,spin=0,swingAngle=0,shake=0,hitStop=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const MOVE_DISTANCE_PER_ENERGY=16;
  const SLIME_TYPES={
    blue:{kind:'blue',hp:1,attack:1,color:'#66c8ee',radius:14},
    green:{kind:'green',hp:2,attack:1,color:'#74d590',radius:16},
    red:{kind:'red',hp:3,attack:1,color:'#e97a83',radius:18},
    purple:{kind:'purple',hp:10,attack:5,color:'#b679e5',radius:22},
    black:{kind:'black',hp:20,attack:10,color:'#171a20',radius:24,knockback:false},
    metal:{kind:'metal',hp:50,attack:20,color:'#bec8d1',radius:26}
  };
  function attackDamage(count){
    if(count>0&&count%100===0)return 20;
    return count>0&&count%50===0?5:1;
  }
  const minY=()=>Math.max(92/VIEW_SCALE,h*.12),maxY=()=>Math.max(minY()+60,h-130/VIEW_SCALE);

  function renderTerrain(){
    if(!w||!h||!tileImage.naturalWidth)return;
    const terrain=document.createElement('canvas');
    terrain.width=Math.ceil(w);terrain.height=Math.ceil(h);
    const ground=terrain.getContext('2d');
    ground.imageSmoothingEnabled=false;
    for(let y=0;y<h;y+=mapTools.tileSize)for(let x=0;x<w;x+=mapTools.tileSize)
      mapTools.drawTile(ground,tileImage,0,x,y);
    const left=Math.round((w-map.width*mapTools.tileSize)/2);
    const top=Math.round((h-map.height*mapTools.tileSize)/2);
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)
      mapTools.drawTile(ground,tileImage,map.tiles[y*map.width+x],left+x*mapTools.tileSize,top+y*mapTools.tileSize);
    terrainCanvas=terrain;
  }

  function resize(){
    const oldW=w,oldH=h,app=$('app');
    w=app.clientWidth/VIEW_SCALE;h=app.clientHeight/VIEW_SCALE;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(app.clientWidth*dpr);canvas.height=Math.round(app.clientHeight*dpr);
    ctx.setTransform(dpr*VIEW_SCALE,0,0,dpr*VIEW_SCALE,0,0);
    if(!oldW){player.x=w/2;player.y=(minY()+maxY())/2}
    else{player.x=clamp(player.x*w/oldW,18,w-18);player.y=clamp(player.y*h/oldH,minY()+18,maxY()-18)}
    renderTerrain();
  }
  addEventListener('resize',resize);
  window.visualViewport?.addEventListener('resize',resize);
  resize();

  const face=$('clock');
  for(let i=0;i<60;i++){
    const tick=document.createElement('i'),angle=i*6*Math.PI/180,r=face.offsetWidth*.43;
    tick.className='tick';tick.style.transform=`translate(-50%,-50%) translate(${Math.sin(angle)*r}px,${-Math.cos(angle)*r}px) rotate(${i*6}deg)`;
    tick.style.height=i%5?'5px':'10px';face.insertBefore(tick,ui.hourHand);
  }
  const stockSlots=[];
  const hourglassSvg=()=>`<svg class="hourglass-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 2h18M7 30h18M9 3v4c0 4 7 7 7 9s-7 5-7 9v4M23 3v4c0 4-7 7-7 9s7 5 7 9v4"/>${Array.from({length:10},(_,i)=>`<rect class="sand-step" x="${10+i*.5}" y="${26-i}" width="${12-i}" height=".8"/>`).join('')}<path class="sand-source" d="M16 16.5 22 27H10Z"/><path class="sand-target" d="M10 5H22L16 12Z"/><path class="sand-stream" d="M16 16V6"/></svg>`;
  ui.buttonHourglass.innerHTML=hourglassSvg();
  ui.buttonHourglass.querySelectorAll('.sand-step').forEach((step,i)=>step.classList.toggle('filled',i<5));
  ui.previewHourglass.innerHTML=hourglassSvg();
  for(let i=0;i<10;i++){
    const slot=document.createElement('span');slot.className='stock-slot';
    slot.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 3h8v5l3 3v16c0 2-2 3-4 3h-6c-2 0-4-1-4-3V11l3-3z"/><path d="M11 8h10"/><path class="bottle-sand" d="M11 21h10v6H11z"/></svg>';
    ui.clockStock.appendChild(slot);stockSlots.push(slot);
  }
  function showSand(steps){
    ui.previewHourglass.style.setProperty('--sand-level',String(steps/10));
    ui.previewSandCount.textContent=`砂のビン ${steps}/10`;
  }

  function updateClock(now){
    const phase=((now-clockOrigin)%3000+3000)%3000/3000;
    ui.hourHand.style.transform=`rotate(${-phase*720}deg)`;
    ui.minuteHand.style.transform=`rotate(${-phase*360}deg)`;
  }
  function setHud(){
    ui.score.textContent=roundKills;
    ui.roundNumber.textContent=round;
    ui.roundTarget.textContent=round*10;
    ui.energyValue.textContent=energy;
    ui.energyFill.style.width=`${Math.min(100,energy)}%`;
    ui.grayDamageFill.style.width=energy===0?`${grayHits/3*100}%`:'0%';
    ui.energyBar.setAttribute('aria-valuenow',String(energy));
    ui.energyBar.setAttribute('aria-valuemax',String(Math.max(100,energy)));
    ui.energyBar.setAttribute('aria-valuetext',energy===0&&unlocked>0?`行動力0、灰色状態での被弾 ${grayHits} / 3`:`行動力 ${energy}`);
    ui.attackCount.textContent=swordCount;
    ui.clockCount.textContent=unlocked;
    if(mode!=='turning'&&mode!=='confirmed')showSand(selectionReason==='refill'&&mode==='select'?selectionIcons:unlocked);
    ui.clockButton.disabled=mode!=='play'||unlocked===0;
    ui.pauseButton.disabled=mode!=='play';
    ui.clockButton.classList.toggle('ready',mode==='play'&&unlocked>0);
    ui.clockButton.classList.toggle('stock-full',unlocked>=10);
    ui.attack.disabled=mode!=='play'||energy<=0;
    ui.attack.classList.toggle('available',mode==='play'&&energy>0);
    ui.attack.classList.toggle('spin-ready',swordCount>=10);
    ui.energyBar.classList.toggle('hit',damageFlash>0);
    for(let i=0;i<stockSlots.length;i++){
      stockSlots[i].classList.toggle('unlocked',i<unlocked);
      stockSlots[i].title=`砂のビン ${i+1}: ${i<unlocked?'砂入り':'空'}`;
    }
  }
  function spendEnergy(amount){
    const before=energy;
    energy=Math.max(0,energy-amount);
    if(energy===0)drag.pointer=null;
    if(before>10&&energy<=10)lowEnergyGray=true;
    setHud();
  }
  function cancelCharge(){
    clearTimeout(charge.timer);charge.pointer=null;charge.timer=null;
    ui.attack.classList.remove('charging');ui.attack.style.setProperty('--charge','0%');
  }
  function startSelection(initial=false,icons=0){
    clearTimeout(transitionTimer);transitionTimer=null;cancelCharge();
    mode='select';selectionReason=initial?'start':'refill';selectionIcons=icons;selectionKills=initial?0:score;drag.pointer=null;shake=0;
    clockOrigin=performance.now()-(initial?61/1440*3000:0);
    ui.overlay.classList.remove('hidden');
    ui.killWarning.classList.add('hidden');
    ui.panel.classList.remove('gameover','paused','confirmed','refill','turning');ui.panel.classList.add('selecting');
    ui.panel.classList.toggle('refill',!initial);
    ui.sandPreview.classList.remove('flipped','flowing','flowed');
    ui.eyebrow.textContent=initial?'':'砂時計';
    ui.title.textContent=initial?'時を止めて、戦え。':'砂時計を返そう';
    ui.description.textContent='';
    ui.resultValue.textContent='';ui.stop.disabled=false;ui.stop.textContent='光を';ui.debug.disabled=false;
    ui.sub.textContent='';setHud();
  }
  function stopClock(debug=false){
    if(mode==='gameover'){restart();return}
    if(mode!=='select')return;
    if(selectionReason==='refill'){
      mode='turning';ui.stop.disabled=true;ui.debug.disabled=true;
      ui.panel.classList.add('turning');ui.sandPreview.classList.add('flipped');setHud();
      transitionTimer=setTimeout(()=>flowSand(debug),433);
      return;
    }
    updateClock(performance.now());
    finishClock(debug);
  }
  function flowSand(debug){
    if(mode!=='turning')return;
    ui.sandPreview.classList.add('flowing');
    transitionTimer=setTimeout(()=>{
      if(mode!=='turning')return;
      ui.sandPreview.classList.remove('flowing');ui.sandPreview.classList.add('flowed');
      transitionTimer=setTimeout(()=>finishClock(debug),167);
    },533);
  }
  function finishClock(debug){
    const gained=debug||selectionReason==='start'?100:Math.floor(selectionIcons*10*(1+selectionKills/100));
    energy+=gained;moveProgress=0;grayHits=0;lowEnergyGray=false;
    mode='confirmed';ui.panel.classList.remove('selecting','turning');ui.panel.classList.add('confirmed');
    ui.resultValue.textContent=gained;
    ui.eyebrow.textContent='行動力を取得';ui.title.textContent=`+${gained}`;
    ui.description.textContent=`元の値と合わせて行動力 ${energy}。1秒後に戦闘を再開します。`;
    ui.stop.disabled=true;ui.debug.disabled=true;ui.stop.textContent='';ui.sub.textContent='まもなく開始';setHud();
    transitionTimer=setTimeout(()=>{
      if(mode!=='confirmed')return;
      mode=selectionReason==='start'?'entry':'play';entryGray=selectionReason==='start'?2:0;
      if(selectionReason==='refill')invincible=Math.max(invincible,2);
      ui.overlay.classList.add('hidden');spawnTimer=0;shake=0;transitionTimer=null;last=performance.now();setHud();
    },1000);
  }
  ui.stop.addEventListener('click',()=>stopClock());
  ui.debug.addEventListener('click',()=>stopClock(true));
  ui.pauseButton.addEventListener('click',()=>{
    if(mode!=='play')return;
    mode='manual-pause';drag.pointer=null;cancelCharge();
    ui.pauseScreen.classList.remove('hidden');setHud();
  });
  ui.resumeButton.addEventListener('click',()=>{
    if(mode!=='manual-pause')return;
    mode='play';ui.pauseScreen.classList.add('hidden');last=performance.now();setHud();
  });
  function restart(){
    clearTimeout(transitionTimer);energy=0;moveProgress=0;unlocked=0;score=0;round=1;roundKills=0;roundSpawned=0;swordCount=0;elapsed=0;timeSinceKill=0;purpleSpawned=false;damageFlash=0;grayHits=0;lowEnergyGray=false;
    ui.elapsedTime.textContent='0:00';
    ui.pauseScreen.classList.add('hidden');
    ui.killWarning.classList.add('hidden');
    enemies.length=0;deadEnemies.length=0;particles.length=0;explosions.length=0;damageNumbers.length=0;
    player.x=w/2;player.y=(minY()+maxY())/2;invincible=0;entryGray=0;swing=0;spin=0;hitStop=0;
    startSelection(true);
  }
  function gameOver(reason='energy'){
    clearTimeout(transitionTimer);cancelCharge();mode='gameover';drag.pointer=null;
    ui.killWarning.classList.add('hidden');
    ui.overlay.classList.remove('hidden');ui.panel.classList.remove('selecting','paused','confirmed','refill','turning');ui.panel.classList.add('gameover');
    ui.eyebrow.textContent='GAME OVER';ui.title.textContent=`討伐 ${score} 体`;
    ui.description.textContent=reason==='no-kill'?'一定時間、敵を倒せませんでした。もう一度挑戦しよう。':grayHits>=3?'灰色状態で3回攻撃を受けました。もう一度挑戦しよう。':'行動力がなくなりました。もう一度挑戦しよう。';
    ui.stop.disabled=false;ui.stop.textContent='もう一度遊ぶ';ui.sub.textContent='';setHud();
  }
  function checkExhausted(){
    if(mode!=='play'||energy>0||swing>0||spin>0||unlocked>0)return;
    gameOver();
  }
  function burst(x,y,color,count){
    for(let i=0;i<count;i++){
      const angle=Math.random()*Math.PI*2,speed=35+Math.random()*90;
      particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.25+Math.random()*.3,max:.55,color});
    }
  }
  function showDamage(enemy,amount){
    const columns=[0,-1,1,-2,2];
    const baseY=enemy.y-enemy.r-22;
    let x=enemy.x,y=baseY;
    for(let slot=0;slot<30;slot++){
      const candidateX=enemy.x+columns[slot%5]*35+(Math.random()-.5)*5;
      const candidateY=baseY-Math.floor(slot/5)*24;
      x=candidateX;y=candidateY;
      if(!damageNumbers.some(number=>Math.abs(number.x-x)<33&&Math.abs(number.y-y)<22))break;
    }
    damageNumbers.push({x,y,amount,life:.85,max:.85});
  }
  function updateHitEffects(dt){
    for(let i=deadEnemies.length-1;i>=0;i--){
      deadEnemies[i].deathTime-=dt;
      if(deadEnemies[i].deathTime<=0)deadEnemies.splice(i,1);
    }
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      if(p.life<=0)particles.splice(i,1);
    }
    for(let i=explosions.length-1;i>=0;i--){
      explosions[i].life-=dt;
      if(explosions[i].life<=0)explosions.splice(i,1);
    }
    for(let i=damageNumbers.length-1;i>=0;i--){
      const number=damageNumbers[i];number.y-=18*dt;number.life-=dt;
      if(number.life<=0)damageNumbers.splice(i,1);
    }
  }
  function useStoredClock(){
    if(mode!=='play'||unlocked===0||hitStop>0)return;
    const icons=unlocked;unlocked=0;setHud();startSelection(false,icons);
  }
  function movePlayer(dx,dy){
    if(mode!=='play'||energy<=0||hitStop>0)return;
    const length=Math.hypot(dx,dy);if(length<.1)return;
    player.angle=Math.atan2(dy,dx);
    const scale=Math.min(1,(energy*MOVE_DISTANCE_PER_ENERGY-moveProgress)/length),oldX=player.x,oldY=player.y;
    player.x=clamp(player.x+dx*scale,player.r+4,w-player.r-4);
    player.y=clamp(player.y+dy*scale,minY()+player.r,maxY()-player.r);
    moveProgress+=Math.hypot(player.x-oldX,player.y-oldY);
    const spent=Math.floor((moveProgress+1e-6)/MOVE_DISTANCE_PER_ENERGY);
    if(spent>0){moveProgress=Math.max(0,moveProgress-spent*MOVE_DISTANCE_PER_ENERGY);spendEnergy(spent)}
    checkExhausted();
  }
  function aimAt(clientX,clientY){
    if(mode!=='play'||energy<=0)return;
    const rect=canvas.getBoundingClientRect();
    const dx=(clientX-rect.left)/VIEW_SCALE-player.x,dy=(clientY-rect.top)/VIEW_SCALE-player.y;
    if(Math.hypot(dx,dy)>8)player.angle=Math.atan2(dy,dx);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='play'||energy<=0||hitStop>0)return;
    e.preventDefault();canvas.setPointerCapture(e.pointerId);
    drag.pointer=e.pointerId;drag.x=e.clientX;drag.y=e.clientY;aimAt(e.clientX,e.clientY);
  });
  canvas.addEventListener('pointermove',e=>{
    if(drag.pointer!==e.pointerId)return;
    if(mode!=='play'||energy<=0){drag.pointer=null;return}
    e.preventDefault();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    drag.x=e.clientX;drag.y=e.clientY;
    movePlayer(dx*.8/VIEW_SCALE,dy*.8/VIEW_SCALE);
  });
  function endDrag(e){if(drag.pointer===e.pointerId)drag.pointer=null}
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',endDrag);
  ui.clockButton.addEventListener('pointerdown',e=>{e.preventDefault();useStoredClock()});
  ui.attack.addEventListener('pointerdown',e=>{
    if(mode!=='play'||energy<=0)return;
    e.preventDefault();ui.attack.setPointerCapture(e.pointerId);
    cancelCharge();charge.pointer=e.pointerId;charge.start=performance.now();
    if(swordCount>=10){
      ui.attack.classList.add('charging');
      charge.timer=setTimeout(()=>{
        if(charge.pointer!==e.pointerId||mode!=='play'||energy<=0||swordCount<10)return;
        spinAttack();cancelCharge();
      },2000);
    }
  });
  ui.attack.addEventListener('pointerup',e=>{
    if(charge.pointer!==e.pointerId)return;
    cancelCharge();attack();
  });
  ui.attack.addEventListener('pointercancel',e=>{if(charge.pointer===e.pointerId)cancelCharge()});
  ui.attack.addEventListener('lostpointercapture',e=>{if(charge.pointer===e.pointerId)cancelCharge()});
  for(const type of ['contextmenu','dblclick','gesturestart','gesturechange','selectstart'])
    document.addEventListener(type,e=>e.preventDefault(),{passive:false});
  addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    keys.add(e.code);if(e.code==='Space'&&!e.repeat)attack();
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>{keys.clear();drag.pointer=null;cancelCharge()});
  function hitEnemies(damage,fullCircle){
    const ax=Math.cos(player.angle),ay=Math.sin(player.angle);
    let defeated=false;
    for(let i=enemies.length-1;i>=0;i--){
      const enemy=enemies[i],dx=enemy.x-player.x,dy=enemy.y-player.y,len=Math.hypot(dx,dy);
      if(len>=player.r+enemy.r+51||(!fullCircle&&len>=25&&(dx*ax+dy*ay)/len<=-.2))continue;
      const knockAngle=len>0?Math.atan2(dy,dx):player.angle;
      if(enemy.knockback){enemy.x+=Math.cos(knockAngle)*15/VIEW_SCALE;enemy.y+=Math.sin(knockAngle)*15/VIEW_SCALE}
      enemy.hp-=damage;enemy.hit=.18;
      explosions.push({x:enemy.x,y:enemy.y,r:enemy.r,life:.45,max:.45});
      burst(enemy.x,enemy.y,'#fff1c3',15);showDamage(enemy,damage);
      if(enemy.hp>0)continue;
      defeated=true;deadEnemies.push({...enemy,deathTime:.45});
      score++;roundKills++;swordCount++;unlocked=Math.min(10,unlocked+1);timeSinceKill=0;ui.killWarning.classList.add('hidden');burst(enemy.x,enemy.y,enemy.color,11);
      enemies.splice(i,1);
    }
    if(defeated){hitStop=.1;drag.pointer=null}
    if(roundKills>=round*10){
      round++;roundKills=0;roundSpawned=0;spawnTimer=0;
      enemies.length=0;
    }
  }
  function attack(){
    if(mode!=='play'||energy<=0||swing>0||spin>0||hitStop>0)return;
    const damage=attackDamage(swordCount);
    spendEnergy(1);swing=.27;swingAngle=player.angle;
    hitEnemies(damage,false);
    setHud();checkExhausted();
  }
  function spinAttack(){
    if(mode!=='play'||energy<=0||swordCount<10||swing>0||spin>0||hitStop>0)return;
    const damage=Math.max(5,attackDamage(swordCount));
    swordCount-=10;spin=.55;swingAngle=player.angle;
    hitEnemies(damage,true);
    setHud();checkExhausted();
  }
  function spawn(forcePurple=false){
    if(roundSpawned>=round*10)return;
    const purple=forcePurple||elapsed>=60&&Math.random()<.15;
    const normalTypes=round>=4?[SLIME_TYPES.green,SLIME_TYPES.red,SLIME_TYPES.black]:[SLIME_TYPES.blue,SLIME_TYPES.green,SLIME_TYPES.red];
    if(round>=5&&!enemies.some(enemy=>enemy.kind==='metal'))normalTypes.push(SLIME_TYPES.metal);
    const type=purple?SLIME_TYPES.purple:normalTypes[Math.floor(Math.random()*normalTypes.length)];
    const hp=type.hp,edge=Math.floor(Math.random()*4),r=type.radius;
    let x,y;
    if(edge===0){x=-r;y=minY()+Math.random()*(maxY()-minY())}
    else if(edge===1){x=w+r;y=minY()+Math.random()*(maxY()-minY())}
    else if(edge===2){x=Math.random()*w;y=minY()-r}
    else{x=Math.random()*w;y=maxY()+r}
    enemies.push({x,y,r,hp,hpMax:hp,kind:type.kind,attack:type.attack,knockback:type.knockback!==false,color:type.color,speed:21+Math.random()*12+score*.3,hit:0,wobble:Math.random()*6.28});
    roundSpawned++;
  }
  function update(dt){
    if(mode==='entry'){
      entryGray=Math.max(0,entryGray-dt);
      if(entryGray===0){mode='play';setHud()}
      return;
    }
    if(mode!=='play')return;
    if(hitStop>0){hitStop=Math.max(0,hitStop-dt);updateHitEffects(dt);return}
    const previousSecond=Math.floor(elapsed);
    elapsed+=dt;
    if(score>0)timeSinceKill+=dt;
    if(score>0&&timeSinceKill>=60){
      const countdown=Math.ceil(65-timeSinceKill);
      if(countdown<=0){gameOver('no-kill');return}
      ui.killCountdown.textContent=countdown;
      ui.killWarning.classList.remove('hidden');
    }
    if(Math.floor(elapsed)!==previousSecond){
      const seconds=Math.floor(elapsed);
      ui.elapsedTime.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    }
    if(!purpleSpawned&&elapsed>=60){purpleSpawned=true;spawn(true)}
    let dx=0,dy=0;
    if(keys.has('ArrowLeft')||keys.has('KeyA'))dx--;
    if(keys.has('ArrowRight')||keys.has('KeyD'))dx++;
    if(keys.has('ArrowUp')||keys.has('KeyW'))dy--;
    if(keys.has('ArrowDown')||keys.has('KeyS'))dy++;
    const length=Math.hypot(dx,dy);
    if(length){movePlayer(dx/length*124*dt,dy/length*124*dt);if(mode!=='play')return}
    spawnTimer+=dt;
    if(spawnTimer>Math.max(.65,1.8-score*.02)){spawnTimer=0;spawn()}
    invincible=Math.max(0,invincible-dt);damageFlash=Math.max(0,damageFlash-dt);ui.energyBar.classList.toggle('hit',damageFlash>0);
    swing=Math.max(0,swing-dt);spin=Math.max(0,spin-dt);shake=Math.max(0,shake-dt);
    for(const enemy of enemies){
      enemy.wobble+=dt*5;enemy.hit=Math.max(0,enemy.hit-dt);
      const ex=player.x-enemy.x,ey=player.y-enemy.y,len=Math.hypot(ex,ey)||1;
      enemy.x+=ex/len*enemy.speed*dt;enemy.y+=ey/len*enemy.speed*dt;
      if(len<player.r+enemy.r-3&&invincible<=0){
        damageFlash=.5;
        player.x=clamp(player.x+ex/len*4/VIEW_SCALE,player.r+4,w-player.r-4);
        player.y=clamp(player.y+ey/len*4/VIEW_SCALE,minY()+player.r,maxY()-player.r);
        if(energy===0&&unlocked>0){grayHits=Math.min(3,grayHits+1);setHud()}
        else spendEnergy(enemy.attack*round);
        invincible=1.15;shake=.2;burst(player.x,player.y,'#fff4dc',9);
        if(grayHits>=3){
          mode='defeated';drag.pointer=null;cancelCharge();setHud();
          transitionTimer=setTimeout(()=>{if(mode==='defeated')gameOver()},450);
          break;
        }
      }
    }
    updateHitEffects(dt);
    checkExhausted();
  }
  function drawSword(angle,radius,opacity){
    if(!swordImage.complete||!swordImage.naturalWidth)return;
    ctx.save();
    ctx.globalAlpha=opacity;
    ctx.translate(player.x+Math.cos(angle)*(radius-40),player.y+Math.sin(angle)*(radius-40));
    ctx.rotate(angle+Math.PI/2);
    // SVG の柄を手元に置き、刃先を軌跡の外周へ向ける。
    ctx.drawImage(swordImage,-25,-44,50,50);
    ctx.restore();
  }
  function draw(now){
    ctx.clearRect(0,0,w,h);ctx.save();
    if(shake>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*5);
    if(terrainCanvas){ctx.imageSmoothingEnabled=false;ctx.drawImage(terrainCanvas,0,0);ctx.imageSmoothingEnabled=true}
    else{ctx.fillStyle='#447a45';ctx.fillRect(0,0,w,h)}
    ctx.strokeStyle='#e7d49e55';ctx.lineWidth=2;ctx.strokeRect(8,minY(),w-16,maxY()-minY());
    for(const enemy of [...enemies,...deadEnemies]){
      const dying=enemy.deathTime!==undefined;
      if(dying&&Math.floor(now/55)%2===0)continue;
      const y=enemy.y+Math.sin(enemy.wobble)*2;
      ctx.fillStyle='#0b172277';ctx.beginPath();ctx.ellipse(enemy.x,y+enemy.r*.8,enemy.r,5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=enemy.hit>0?'#fff':enemy.color;ctx.beginPath();ctx.arc(enemy.x,y,enemy.r,Math.PI,0);
      ctx.quadraticCurveTo(enemy.x+enemy.r,y+enemy.r*.85,enemy.x,y+enemy.r*.7);
      ctx.quadraticCurveTo(enemy.x-enemy.r,y+enemy.r*.85,enemy.x-enemy.r,y);ctx.fill();
      ctx.fillStyle='#24333b';ctx.beginPath();ctx.arc(enemy.x-5,y-2,2,0,7);ctx.arc(enemy.x+5,y-2,2,0,7);ctx.fill();
      if(dying)continue;
      const barW=Math.max(34,enemy.r*2),barX=enemy.x-barW/2,barY=y-enemy.r-12;
      ctx.fillStyle='#17242adf';ctx.fillRect(barX-2,barY-2,barW+4,8);
      ctx.fillStyle='#642d35';ctx.fillRect(barX,barY,barW,4);
      ctx.fillStyle=enemy.hp/enemy.hpMax>.5?'#80d98a':enemy.hp/enemy.hpMax>.25?'#f1c66b':'#f07773';
      ctx.fillRect(barX,barY,barW*Math.max(0,enemy.hp/enemy.hpMax),4);
    }
    for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,4,4)}
    ctx.globalAlpha=1;
    for(const explosion of explosions){
      const progress=1-explosion.life/explosion.max;
      ctx.save();ctx.globalAlpha=1-progress;ctx.strokeStyle='#fff4ca';ctx.lineWidth=4-progress*3;
      ctx.shadowColor='#ffb646';ctx.shadowBlur=14;
      ctx.beginPath();ctx.arc(explosion.x,explosion.y,6+progress*(explosion.r+18),0,Math.PI*2);ctx.stroke();
      for(let ray=0;ray<8;ray++){
        const angle=ray*Math.PI/4+progress*.3,inner=explosion.r*.45+progress*8,outer=inner+8+progress*13;
        ctx.beginPath();ctx.moveTo(explosion.x+Math.cos(angle)*inner,explosion.y+Math.sin(angle)*inner);
        ctx.lineTo(explosion.x+Math.cos(angle)*outer,explosion.y+Math.sin(angle)*outer);ctx.stroke();
      }
      ctx.restore();
    }
    if(swing>0){ctx.strokeStyle=`rgba(255,224,158,${swing/.27})`;ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.arc(player.x,player.y,49,swingAngle-.95,swingAngle+.95);ctx.stroke()}
    if(spin>0){
      const progress=1-spin/.55,angle=swingAngle+progress*Math.PI*2;
      ctx.strokeStyle=`rgba(255,214,133,${spin/.55})`;ctx.lineWidth=13;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(player.x,player.y,53,angle-1.1,angle+1.1);ctx.stroke();
      ctx.strokeStyle=`rgba(255,245,210,${spin/.55*.65})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(player.x,player.y,53,0,Math.PI*2);ctx.stroke();
    }
    ctx.globalAlpha=invincible>0&&Math.floor(now/90)%2?.4:1;
    ctx.fillStyle='#111d26aa';ctx.beginPath();ctx.ellipse(player.x,player.y+14,17,6,0,0,7);ctx.fill();
    const direction=((Math.round((player.angle+Math.PI/2)/(Math.PI/4))%8)+8)%8;
    const sprite=playerSprites[direction],graySprite=playerSpritesGray[direction];
    if(sprite){
      const height=56,width=height*sprite.width/sprite.height;
      ctx.imageSmoothingEnabled=false;
      const left=player.x-width/2,top=player.y+21-height;
      if((entryGray>0||energy===0&&unlocked>0)&&graySprite)ctx.drawImage(graySprite,left,top,width,height);
      else{
        ctx.drawImage(sprite,left,top,width,height);
        if(lowEnergyGray&&graySprite){
          const alpha=ctx.globalAlpha;ctx.globalAlpha=alpha*.5;
          ctx.drawImage(graySprite,left,top,width,height);ctx.globalAlpha=alpha;
        }
      }
      ctx.imageSmoothingEnabled=true;
    }else{
      ctx.fillStyle=entryGray>0||energy===0&&unlocked>0?'#b9b9b9':'#f3eee0';ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,7);ctx.fill();
      ctx.fillStyle=entryGray>0||energy===0&&unlocked>0?'#777':'#566d75';ctx.beginPath();ctx.arc(player.x,player.y,player.r-5,0,7);ctx.fill();
    }
    ctx.globalAlpha=1;
    const auraDamage=attackDamage(swordCount);
    if(auraDamage>1){
      const color=auraDamage===20?'#ff554d':'#f7fbff';
      ctx.save();ctx.strokeStyle=color;ctx.lineWidth=auraDamage===20?4:3;
      ctx.shadowColor=color;ctx.shadowBlur=18+Math.sin(now/150)*4;
      ctx.globalAlpha=.8+Math.sin(now/180)*.13;
      ctx.beginPath();ctx.ellipse(player.x,player.y-5,26,31,0,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.3;ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(player.x,player.y-5,31,36,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    if(swing>0){
      const progress=1-swing/.27;
      drawSword(swingAngle-.95+progress*1.9,49,Math.min(1,swing/.055));
    }
    if(spin>0){
      const progress=1-spin/.55;
      drawSword(swingAngle+progress*Math.PI*2,53,Math.min(1,spin/.075));
    }
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 21px system-ui, sans-serif';ctx.lineWidth=4;ctx.strokeStyle='#182126';
    for(const number of damageNumbers){
      ctx.globalAlpha=clamp(number.life/number.max*1.6,0,1);
      ctx.fillStyle=number.amount>=20?'#ff7266':number.amount>=5?'#ffe284':'#fff8ec';
      ctx.strokeText(String(number.amount),number.x,number.y);
      ctx.fillText(String(number.amount),number.x,number.y);
    }
    ctx.restore();
    ctx.restore();
  }
  function frame(now){
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(mode==='select')updateClock(now);
    if(charge.pointer!==null&&charge.timer!==null)ui.attack.style.setProperty('--charge',`${Math.min(100,(now-charge.start)/20)}%`);
    update(dt);draw(now);requestAnimationFrame(frame);
  }
  setHud();requestAnimationFrame(frame);
})();
