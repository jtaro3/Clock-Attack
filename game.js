(async()=>{
  'use strict';
  let gameData={};
  try{
    const response=await fetch('game-data.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    gameData=await response.json();
  }catch(error){document.getElementById('panel').textContent='ゲームデータを読み込めませんでした。CSV出力とローカルサーバーを確認して再読み込みしてください。';console.error(error);return}
  let animationManifest={enemies:{}};
  try{const response=await fetch('animation-manifest.json',{cache:'no-store'});if(response.ok)animationManifest=await response.json()}catch{}
  const general=gameData.general||{},playerData=gameData.player||{},enemyData=gameData.enemies||{},roundData=gameData.rounds||{};
  const setting=(source,key,fallback)=>Number.isFinite(Number(source[key]))?Number(source[key]):fallback;
  const blueSlimeTuning=(()=>{
    const blueData=enemyData.slime_blue||{};
    const values={moveSpeed:setting(blueData,'move_speed_px_per_second',27),idleTime:setting(blueData,'animation_idle_seconds',.38),midTime:setting(blueData,'animation_jump_mid_seconds',.12),peakTime:setting(blueData,'animation_jump_peak_seconds',.12),moveTimes:Array.isArray(blueData.animation_move_frame_seconds)?blueData.animation_move_frame_seconds:[],attackTimes:Array.isArray(blueData.animation_attack_frame_seconds)?blueData.animation_attack_frame_seconds:[]};
    values.moveSpeed=Math.max(0,Math.min(80,values.moveSpeed));
    for(const key of ['idleTime','midTime','peakTime'])values[key]=Math.max(.04,Math.min(1.2,values[key]));
    return values;
  })();
  const $=id=>document.getElementById(id);
  const canvas=$('field'),ctx=canvas.getContext('2d');
  const query=new URLSearchParams(location.search),effectPreviewMode=query.has('effectPreview'),clearPreviewMode=query.has('clearPreview');
  const ui={overlay:$('overlay'),panel:$('panel'),title:$('title'),eyebrow:$('eyebrow'),description:$('description'),resultValue:$('resultValue'),stop:$('stop'),sub:$('sub'),score:$('score'),roundNumber:$('roundNumber'),roundTarget:$('roundTarget'),elapsedTime:$('elapsedTime'),energyValue:$('energyValue'),energyFill:$('energyFill'),grayDamageFill:$('grayDamageFill'),energyBar:document.querySelector('.energy-bar'),swordCounter:$('swordCounter'),attackCount:$('attackCount'),clockCount:$('clockCount'),clockButton:$('clockButton'),clockStock:$('clockStock'),buttonHourglass:$('buttonHourglass'),mergeStage:$('mergeStage'),mergeBottles:$('mergeBottles'),mergeHourglass:$('mergeHourglass'),sandPreview:$('sandPreview'),previewSandCount:$('previewSandCount'),previewHourglass:$('previewHourglass'),killWarning:$('killWarning'),killCountdown:$('killCountdown'),attack:$('attack'),speedButton:$('speedButton'),instantKillButton:$('instantKillButton'),pauseButton:$('pauseButton'),pauseScreen:$('pauseScreen'),resumeButton:$('resumeButton'),gridToggle:$('gridToggle'),clearScreen:$('clearScreen'),clearAnnouncement:$('clearAnnouncement'),clearHourglass:$('clearHourglass'),clearScore:$('clearScore'),clearTime:$('clearTime'),clearActions:$('clearActions'),clearRetry:$('clearRetry'),clearTitleLink:$('clearTitleLink')};
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
  const zoomLevels=[1,.85,.6,.5];
  let zoomIndex=0;
  const cameraZoom=()=>zoomLevels[zoomIndex];
  const mapTools=window.ClockAttackMap;
  let map=mapTools.defaultMap();
  let collisionCatalog=['grass.png','grass-dark.png','flowers.png','soil.png'].map(file=>({file}));
  try{
    const response=await fetch('maps/clock-attack-grassland.json',{cache:'no-store'});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const mapJson=await response.json();
    if(mapJson.tileset){
      if(mapJson.version!==1||!Array.isArray(mapJson.tileset)||!Array.isArray(mapJson.tiles)||mapJson.tiles.length!==mapJson.width*mapJson.height||!mapJson.tiles.every(id=>Number.isInteger(id)&&id>=0&&id<mapJson.tileset.length)||!mapTools.configureTiles(mapJson.tileset))throw Error('チップ一覧が不正です');
    }
    const imported=mapTools.normalize(mapJson);
    if(!imported)throw Error('マップJSONの形式が不正です');
    map=imported;
    if(mapJson.tileset)collisionCatalog=mapJson.tileset;
  }catch(error){console.warn('マップJSONを読み込めないため標準マップで起動します。',error)}
  const mapSettings=new Map((gameData.map_tiles||[]).map(tile=>[tile.sprite_file,tile]));
  collisionCatalog=collisionCatalog.map(tile=>({...tile,...(mapSettings.get(tile.file)||{})}));
  const objectDestruction=MapDestruction.create(map,collisionCatalog);
  let obstacles=MapCollision.build(objectDestruction.activeMap(),collisionCatalog);
  const tileImage=mapTools.tileFiles.map(()=>new Image());
  let terrainCanvas=null,terrainOrigin={x:0,y:0};
  tileImage.forEach((image,index)=>{
    image.onload=()=>renderTerrain();
    image.onerror=()=>console.warn('マップチップ画像を読み込めませんでした：'+mapTools.tileFiles[index]);
    image.src=mapTools.tileFiles[index];
  });
  const enemies=[],deadEnemies=[],particles=[],explosions=[],damageNumbers=[];
  const drag={pointer:null,x:0,y:0};
  const charge={pointer:null,start:0,timer:null};
  const keys=new Set();
  let w=0,h=0,dpr=1,last=performance.now();
  let mode='select',selectionReason='start',selectionIcons=0,selectionRecovery=0,selectionBottles=[],transitionTimer=null;
  let energy=0,moveProgress=0,unlocked=0,score=0,round=1,roundKills=0,roundSpawned=0,roundElapsed=0,swordCount=0,elapsed=0,timeSinceKill=0,spawnTimer=0,invincible=0,damageFlash=0,grayHits=0,entryGray=0,lowEnergyGray=false,swing=0,spin=0,swingAngle=0,swingScale=1,spinScale=1,shake=0,hitStop=0,timeScale=1,roundSpawnCounts={};
  let recoveryGaugeFrom=0,recoveryGaugeRemaining=0;
  const RECOVERY_GAUGE_SECONDS=1/1.3;
  let showGrid=localStorage.getItem('clock-attack-grid')!=='0';
  const sandBottles=[];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const START_ENERGY=setting(general,'start_energy',100),MOVE_DISTANCE_PER_ENERGY=setting(playerData,'move_distance_per_energy',16);
  const MAX_ENEMIES=setting(general,'max_enemies',20),MAX_PARTICLES=setting(general,'max_particles',200),MAX_SWORD_COUNT=setting(playerData,'max_sword_count',150),MAX_EASY_ROUND=setting(gameData.difficulties?.easy||{},'max_round',3);
  const MAX_HOURGLASS_STOCK=setting(general,'max_hourglass_stock',10),MAX_SAND_DISPLAY=setting(general,'max_sand_display',1000),IDLE_WARNING_SECONDS=setting(general,'idle_warning_seconds',60),GAME_OVER_COUNTDOWN_SECONDS=setting(general,'game_over_countdown_seconds',5),RECOVERY_INVINCIBLE_SECONDS=setting(general,'recovery_invincible_seconds',2),BATTLE_START_DELAY_SECONDS=setting(general,'battle_start_delay_seconds',2);
  const BASE_ATTACK_DAMAGE=setting(playerData,'base_attack_damage',1),WHITE_AURA_DAMAGE=setting(playerData,'white_aura_damage',5),RED_AURA_DAMAGE=setting(playerData,'red_aura_damage',20),SPIN_SWORD_COST=setting(playerData,'spin_sword_cost',10),SPIN_MIN_DAMAGE=setting(playerData,'spin_min_damage',5),WHITE_AURA_INTERVAL=setting(playerData,'white_aura_interval',50),RED_AURA_INTERVAL=setting(playerData,'red_aura_interval',100),SPIN_CHARGE_SECONDS=setting(playerData,'spin_charge_seconds',2);
  const PLAYER_SCALE=setting(playerData,'player_scale',1),SWORD_SCALE=setting(playerData,'sword_scale',1);
  const NORMAL_ATTACK_EFFECT_SCALE=setting(playerData,'normal_attack_effect_scale',1),WHITE_ATTACK_EFFECT_SCALE=setting(playerData,'white_attack_effect_scale',1.5),RED_ATTACK_EFFECT_SCALE=setting(playerData,'red_attack_effect_scale',2);
  const activeRounds=Object.keys(roundData).map(Number).filter(n=>Number.isInteger(n)&&n>0&&n<=MAX_EASY_ROUND).sort((a,b)=>a-b);
  if(!activeRounds.length){ui.panel.textContent='有効なラウンドがありません。roundとdifficultyのマスターを確認してください。';return}
  round=activeRounds[0];
  const currentRoundConfig=roundNumber=>roundData[String(roundNumber)];
  const roundKillTarget=roundNumber=>Number(currentRoundConfig(roundNumber).kill_target);
  const enemyType=(key,kind,hp,attack,color,radius)=>{const data=enemyData[key]||{};return{enemyKey:key,kind,hp:setting(data,'hp',hp),attack:setting(data,'attack',attack),deathHitStop:setting(data,'death_hit_stop_seconds',.1),knockbackDistance:Math.max(0,setting(data,'knockback_distance_px',18.75)),color,radius,knockback:data.super_armor===undefined?kind!=='black':!data.super_armor}};
  const SLIME_TYPES={blue:enemyType('slime_blue','blue',1,1,'#66c8ee',14),green:enemyType('slime_green','green',2,1,'#74d590',16),red:enemyType('slime_red','red',3,1,'#e97a83',18),purple:enemyType('slime_purple','purple',10,5,'#b679e5',22),black:enemyType('slime_black','black',20,10,'#171a20',24),metal:enemyType('slime_metal','metal',50,20,'#bec8d1',26)};
const SLIME_BY_KEY=Object.fromEntries(Object.values(SLIME_TYPES).map(type=>[type.enemyKey,type]));
  const defaultMoveFrames=[
    'design/enemies/slime_blue_idle.png','design/enemies/slime_blue_jump_mid.png','design/enemies/slime_blue_jump_peak.png','design/enemies/slime_blue_jump_mid.png'
  ];
  const defaultAttackFrames=['design/enemies/slime-blue-attack-01.png','design/enemies/slime-blue-attack-02.png','design/enemies/slime-blue-attack-03.png','design/enemies/slime-blue-attack-04.png'];
  const blueMoveFiles=animationManifest.enemies?.slime_blue?.move?.length?animationManifest.enemies.slime_blue.move:defaultMoveFrames;
  const blueAttackFiles=animationManifest.enemies?.slime_blue?.attack?.length?animationManifest.enemies.slime_blue.attack:defaultAttackFrames;
  const blueSlimeFrames=blueMoveFiles.map((file,index)=>{
    const configured=Number(blueSlimeTuning.moveTimes[index]);
    const fallback=[blueSlimeTuning.idleTime,blueSlimeTuning.midTime,blueSlimeTuning.peakTime,blueSlimeTuning.midTime][index]??blueSlimeTuning.midTime;
    return {file,duration:Number.isFinite(configured)&&configured>0?Math.max(.04,Math.min(1.2,configured)):fallback,image:new Image()};
  });
  /* legacy movement frame sequence retained in the manifest defaults */
  /*
    {file:'slime_blue_idle.png',duration:blueSlimeTuning.idleTime,image:new Image()},
    {file:'slime_blue_jump_mid.png',duration:blueSlimeTuning.midTime,image:new Image()},
    {file:'slime_blue_jump_peak.png',duration:blueSlimeTuning.peakTime,image:new Image()},
    {file:'slime_blue_jump_mid.png',duration:blueSlimeTuning.midTime,image:new Image()},
    {file:'slime_blue_idle.png',duration:blueSlimeTuning.idleTime,image:new Image()}
  ]; */
  const SLIME_ATTACK_DURATION=.42;
  const blueSlimeAttackFrames=blueAttackFiles.map(file=>({file,image:new Image(),attack:true}));
  const BLUE_ATTACK_DURATIONS=blueSlimeAttackFrames.map((_,index)=>{const value=Number(blueSlimeTuning.attackTimes[index]);return Number.isFinite(value)&&value>0?Math.max(.04,Math.min(.5,value)):.105});
  const BLUE_ATTACK_DURATION=BLUE_ATTACK_DURATIONS.reduce((sum,duration)=>sum+duration,0);
  const BLUE_SLIME_LOOP_SECONDS=blueSlimeFrames.reduce((sum,frame)=>sum+frame.duration,0);
  blueSlimeFrames.forEach(frame=>{
    frame.image.onload=()=>{
      const flash=document.createElement('canvas');
      flash.width=frame.image.naturalWidth;flash.height=frame.image.naturalHeight;
      const flashCtx=flash.getContext('2d');
      flashCtx.drawImage(frame.image,0,0);
      flashCtx.globalCompositeOperation='source-in';
      flashCtx.fillStyle='#fff';flashCtx.fillRect(0,0,flash.width,flash.height);
      frame.flash=flash;
    };
    frame.image.src=`${frame.file}?sprite=1.04`;
  });
  blueSlimeAttackFrames.forEach(frame=>{frame.image.src=`${frame.file}?sprite=1.04`});
  function blueSlimeFrame(enemy){
    if(enemy.attackTime>0){
      let time=BLUE_ATTACK_DURATION-enemy.attackTime;
      for(let index=0;index<blueSlimeAttackFrames.length;index++){if(time<BLUE_ATTACK_DURATIONS[index])return blueSlimeAttackFrames[index];time-=BLUE_ATTACK_DURATIONS[index]}
      return blueSlimeAttackFrames[blueSlimeAttackFrames.length-1];
    }
    let time=enemy.animationTime%BLUE_SLIME_LOOP_SECONDS;
    for(const frame of blueSlimeFrames){if(time<frame.duration)return frame;time-=frame.duration}
    return blueSlimeFrames[0];
  }
  function attackDamage(count){
    if(count>0&&count%RED_AURA_INTERVAL===0)return RED_AURA_DAMAGE;
    return count>0&&count%WHITE_AURA_INTERVAL===0?WHITE_AURA_DAMAGE:BASE_ATTACK_DAMAGE;
  }
  const attackEffectScale=damage=>damage===RED_AURA_DAMAGE?RED_ATTACK_EFFECT_SCALE:damage===WHITE_AURA_DAMAGE?WHITE_ATTACK_EFFECT_SCALE:NORMAL_ATTACK_EFFECT_SCALE;
  const playerMovementBounds=()=>{
    const maxRatio=Math.max(...spriteBounds.map(([l,t,r,b])=>(r-l+33)/(b-t+33)));
    return BattleMapBounds.centers({left:0,top:0,right:map.width*32,bottom:map.height*32},{x:Math.max(player.r,56*PLAYER_SCALE*maxRatio/2),top:Math.max(player.r,56*PLAYER_SCALE-21),bottom:Math.max(player.r,21)});
  };
  const mapOffset=()=>({x:0,y:0});
  function moveBody(body,dx,dy,r,feet=0){
    const origin=mapOffset(),next=MapCollision.move(body.x-origin.x,body.y+feet-origin.y,dx,dy,r,obstacles);
    body.x=next.x+origin.x;body.y=next.y+origin.y-feet;
  }
  function ensurePlayerFree(){
    const origin=mapOffset(),bounds=playerMovementBounds();
    if(!MapCollision.blocked(player.x-origin.x,player.y+14-origin.y,10,obstacles))return;
    let best=null,distance=Infinity;
    for(let y=bounds.top;y<=bounds.bottom;y+=16)for(let x=bounds.left;x<=bounds.right;x+=16){
      const d=Math.hypot(x-player.x,y-player.y);
      if(d<distance&&!MapCollision.blocked(x-origin.x,y+14-origin.y,10,obstacles)){best={x,y};distance=d}
    }
    if(best){player.x=best.x;player.y=best.y}
  }

  function renderTerrain(){
    if(!w||!h||!tileImage[0].naturalWidth)return;
    const terrain=document.createElement('canvas');
    const size=mapTools.tileSize,left=0,top=0;
    terrain.width=map.width*size;terrain.height=map.height*size;
    terrainOrigin={x:0,y:0};
    const ground=terrain.getContext('2d');ground.imageSmoothingEnabled=false;
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)
      mapTools.drawTile(ground,tileImage,map.tiles[y*map.width+x],left+x*mapTools.tileSize,top+y*mapTools.tileSize);
    for(const object of map.objects||[]){
      if(object.destroyed)continue;
      const image=tileImage[object.id];
      if(image.complete&&image.naturalWidth)ground.drawImage(image,left+object.x*32,top+object.y*32,object.width_tiles*32,object.height_tiles*32);
    }
    terrainCanvas=terrain;
  }

  function resize(){
    const oldW=w,app=$('app');
    w=app.clientWidth/VIEW_SCALE;h=app.clientHeight/VIEW_SCALE;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(app.clientWidth*dpr);canvas.height=Math.round(app.clientHeight*dpr);
    ctx.setTransform(dpr*VIEW_SCALE,0,0,dpr*VIEW_SCALE,0,0);
    if(!oldW){player.x=map.width*16;player.y=map.height*16}
    ensurePlayerFree();
    renderTerrain();
  }
  addEventListener('resize',resize);
  window.visualViewport?.addEventListener('resize',resize);
  resize();

  const stockSlots=[];
  const hourglassSvg=(colors=[],gradientId='mixedSand')=>{
    const stops=colors.length?colors.map((color,i)=>`<stop offset="${colors.length===1?0:i/(colors.length-1)*100}%" stop-color="${color}"/>`).join(''):'<stop offset="0" stop-color="#fff9e8"/>';
    return `<svg class="hourglass-svg" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><path d="M7 2h18M7 30h18M9 3v4c0 4 7 7 7 9s-7 5-7 9v4M23 3v4c0 4-7 7-7 9s7 5 7 9v4"/>${Array.from({length:10},(_,i)=>`<rect class="sand-step" x="${10+i*.5}" y="${26-i}" width="${12-i}" height=".8"/>`).join('')}<path class="sand-source" d="M10 24Q16 21 22 24V28H10Z"/><path class="sand-target" d="M10 4H22V8Q16 11 10 8Z"/><path class="sand-stream" d="M16 16V6"/></svg>`;
  };
  ui.buttonHourglass.innerHTML=hourglassSvg([],'buttonSand');
  ui.previewHourglass.innerHTML=hourglassSvg([],'previewSand');
  for(let i=0;i<MAX_HOURGLASS_STOCK;i++){
    const slot=document.createElement('span');slot.className='stock-slot';
    slot.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 3h8v5l3 3v16c0 2-2 3-4 3h-6c-2 0-4-1-4-3V11l3-3z"/><path d="M11 8h10"/><path class="bottle-sand" d="M11 21h10v6H11z"/></svg>'; 
    ui.clockStock.appendChild(slot);stockSlots.push(slot);
  }
  function showSand(steps){
    ui.previewHourglass.style.setProperty('--sand-level',String(steps/MAX_HOURGLASS_STOCK));
    ui.previewSandCount.textContent=`砂のビン ${steps}/${MAX_HOURGLASS_STOCK}`;
  }
  function showBottleMerge(bottles){
    const finalLevel=clamp((energy+selectionRecovery)/MAX_SAND_DISPLAY,0,1);
    if(selectionReason==='start'&&Number.isFinite(window.__clockAttackInitialMergeStartedAt)){
      const remaining=Math.max(0,700-(performance.now()-window.__clockAttackInitialMergeStartedAt));
      delete window.__clockAttackInitialMergeStartedAt;
      ui.mergeStage.classList.add('collapsing','absorbing');
      ui.mergeHourglass.classList.remove('empty');
      ui.mergeHourglass.style.setProperty('--sand-level',String(finalLevel));
      ui.previewHourglass.style.setProperty('--sand-level',String(finalLevel));
      ui.panel.classList.add('merging');
      ui.stop.disabled=true;
      transitionTimer=setTimeout(()=>{
        ui.panel.classList.remove('merging');ui.mergeStage.classList.remove('collapsing','absorbing');
        ui.stop.disabled=false;transitionTimer=null;
      },Math.max(remaining,600));
      return;
    }
    ui.mergeBottles.innerHTML='';
    bottles.forEach((bottle,i)=>{
      const item=document.createElement('span'),columns=Math.min(5,bottles.length),column=i%5,row=Math.floor(i/5);
      const center=(Math.min(columns,bottles.length-row*5)-1)/2;
      item.className=bottle.empty?'merge-bottle empty':'merge-bottle';
      item.style.setProperty('--bottle-color',bottle.color);
      item.style.setProperty('--start-x',`${(column-center)*64}px`);
      item.style.setProperty('--start-y',`${row*66-(bottles.length>5?33:0)}px`);
      item.style.setProperty('--merge-rotate',`${(i%2?1:-1)*(18+i*5)}deg`);
      item.innerHTML='<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M12 2h8v6l4 4v24c0 3-2 4-5 4h-6c-3 0-5-1-5-4V12l4-4z"/><path d="M10 9h12"/><path class="bottle-fill" d="M10 25h12v11H10z"/></svg>';
      ui.mergeBottles.appendChild(item);
    });
    const initialLevel=clamp(energy/MAX_SAND_DISPLAY,0,1);

    ui.mergeHourglass.innerHTML=hourglassSvg([],'mergeSand');
    ui.mergeHourglass.style.setProperty('--sand-level',String(initialLevel));
    ui.mergeHourglass.style.setProperty('--sand-color','#fff9e8');
    ui.mergeHourglass.classList.toggle('empty',energy===0);
    ui.previewHourglass.innerHTML=hourglassSvg([],'previewSand');
    ui.sandPreview.style.setProperty('--sand-color','#fff9e8');
    ui.previewHourglass.style.setProperty('--sand-level',String(finalLevel));
    ui.panel.classList.add('merging');
    ui.stop.disabled=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      ui.mergeStage.classList.add('collapsing','absorbing');
      ui.mergeHourglass.classList.remove('empty');
      ui.mergeHourglass.style.setProperty('--sand-level',String(finalLevel));
    }));
    transitionTimer=setTimeout(()=>{
      ui.panel.classList.remove('merging');ui.mergeStage.classList.remove('collapsing','absorbing');
      ui.stop.disabled=false;transitionTimer=null;
    },700);
  }

  function setHud(){
    ui.score.textContent=roundKills;
    ui.roundNumber.textContent=round;
    ui.roundTarget.textContent=roundKillTarget(round);
    const recoveryProgress=(mode==='entry'||mode==='refill-entry')?clamp(1-recoveryGaugeRemaining/RECOVERY_GAUGE_SECONDS,0,1):1;
    const displayedEnergy=mode==='entry'||mode==='refill-entry'?Math.round(recoveryGaugeFrom+(energy-recoveryGaugeFrom)*recoveryProgress):mode==='confirmed'?recoveryGaugeFrom:energy;
    ui.energyBar.classList.toggle('recovering',(mode==='entry'||mode==='refill-entry')&&recoveryGaugeRemaining>0);
    ui.energyValue.textContent=displayedEnergy;
    ui.energyFill.style.width=`${Math.min(100,displayedEnergy)}%`;
    ui.grayDamageFill.style.width=energy===0?`${grayHits/3*100}%`:'0%';
    ui.energyBar.setAttribute('aria-valuenow',String(displayedEnergy));
    ui.energyBar.setAttribute('aria-valuemax',String(Math.max(100,energy)));
    ui.energyBar.setAttribute('aria-valuetext',energy===0&&unlocked>0?`行動力0、灰色状態での被弾 ${grayHits} / 3`:`行動力 ${displayedEnergy}`);
    ui.attackCount.textContent=swordCount;
    ui.clockCount.textContent=unlocked;
    if(mode!=='turning'&&mode!=='confirmed')showSand(selectionReason==='refill'&&mode==='select'?selectionIcons:unlocked);
    ui.clockButton.disabled=mode!=='play'||unlocked===0;
    ui.pauseButton.disabled=mode!=='play';
    ui.speedButton.disabled=mode!=='play';
    ui.clockButton.classList.toggle('ready',mode==='play'&&unlocked>0);
    ui.clockButton.classList.toggle('stock-full',unlocked>=MAX_HOURGLASS_STOCK);
    ui.attack.disabled=mode!=='play'||energy<=0;
    ui.attack.classList.toggle('available',mode==='play'&&energy>0);
    ui.attack.classList.toggle('spin-ready',swordCount>=SPIN_SWORD_COST);
    ui.swordCounter.classList.toggle('spin-ready',swordCount>=SPIN_SWORD_COST);
    const auraDamage=attackDamage(swordCount);
    ui.swordCounter.classList.toggle('aura-white',auraDamage===WHITE_AURA_DAMAGE);
    ui.swordCounter.classList.toggle('aura-red',auraDamage===RED_AURA_DAMAGE);
    ui.gridToggle.setAttribute('aria-pressed',String(showGrid));
    ui.gridToggle.textContent=`グリッド表示：${showGrid?'ON':'OFF'}`;
    ui.energyBar.classList.toggle('hit',damageFlash>0);
    for(let i=0;i<stockSlots.length;i++){
      const bottle=sandBottles[i];
      stockSlots[i].classList.toggle('unlocked',Boolean(bottle));
      stockSlots[i].style.setProperty('--bottle-color',bottle?.color||'#fff9e8');
      stockSlots[i].title=`砂のビン ${i+1}: ${bottle?`${bottle.kind}・回復${bottle.recovery}`:'空'}`;
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
  function startSelection(initial=false,icons=0,recovery=0,bottles=[]){
    clearTimeout(transitionTimer);transitionTimer=null;cancelCharge();
    mode='select';selectionReason=initial?'start':'refill';selectionIcons=icons;selectionRecovery=initial?START_ENERGY:recovery;selectionBottles=bottles;drag.pointer=null;shake=0;
    ui.overlay.classList.remove('hidden');
    ui.killWarning.classList.add('hidden');
    ui.panel.classList.remove('gameover','paused','confirmed','refill','turning','merging');ui.panel.classList.add('selecting');
    ui.panel.classList.add('refill');
    ui.sandPreview.classList.remove('flipped','flowing','flowed');ui.mergeStage.classList.remove('collapsing','absorbing');
    ui.eyebrow.textContent='';
    ui.title.textContent='';
    ui.description.textContent='';
    ui.resultValue.textContent='';ui.stop.disabled=false;ui.stop.textContent='光を';
    ui.sub.textContent='';setHud();
    showBottleMerge(initial?[{color:'#fff9e8',empty:true}]:selectionBottles);
  }
  function stopClock(){
    if(mode==='gameover'){restart();return}
    if(mode!=='select')return;
    mode='turning';ui.stop.disabled=true;
    ui.panel.classList.add('turning');ui.sandPreview.classList.add('flipped');setHud();
    transitionTimer=setTimeout(flowSand,289);
  }
  function flowSand(){
    if(mode!=='turning')return;
    ui.sandPreview.classList.add('flowing');
    transitionTimer=setTimeout(()=>{
      if(mode!=='turning')return;
      ui.sandPreview.classList.remove('flowing');ui.sandPreview.classList.add('flowed');
      transitionTimer=setTimeout(finishClock,167);
    },533);
  }
  function finishClock(){
    const gained=selectionReason==='start'?START_ENERGY:selectionRecovery;
    recoveryGaugeFrom=energy;energy+=gained;moveProgress=0;grayHits=0;lowEnergyGray=false;
    mode='confirmed';ui.panel.classList.remove('selecting','turning');ui.panel.classList.add('confirmed');
    ui.resultValue.textContent=gained;
    ui.eyebrow.textContent='';ui.title.textContent='';
    ui.description.textContent='';
    ui.stop.disabled=true;ui.stop.textContent='';ui.sub.textContent='';setHud();
    transitionTimer=setTimeout(()=>{
      if(mode!=='confirmed')return;
      if(effectPreviewMode){energy=0;transitionTimer=null;startEffectPreview();return}
      mode=selectionReason==='start'?'entry':'refill-entry';entryGray=selectionReason==='start'?BATTLE_START_DELAY_SECONDS:0;
      recoveryGaugeRemaining=RECOVERY_GAUGE_SECONDS;
      if(selectionReason==='refill')invincible=Math.max(invincible,RECOVERY_INVINCIBLE_SECONDS);
      ui.overlay.classList.add('hidden');spawnTimer=0;shake=0;transitionTimer=null;last=performance.now();setHud();
    },1000);
  }
  ui.stop.addEventListener('click',()=>stopClock());
  function activateRecovery(event){
    if(mode!=='select'||ui.stop.disabled)return;
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    event.preventDefault();
    stopClock();
  }
  ui.overlay.addEventListener('click',activateRecovery);
  ui.overlay.addEventListener('keydown',activateRecovery);
  ui.pauseButton.addEventListener('click',()=>{
    if(mode!=='play')return;
    mode='manual-pause';drag.pointer=null;cancelCharge();
    $('pauseMenu').hidden=false;$('titleConfirm').hidden=true;
    ui.pauseScreen.classList.remove('hidden');setHud();
  });
  ui.resumeButton.addEventListener('click',()=>{
    if(mode!=='manual-pause')return;
    mode='play';ui.pauseScreen.classList.add('hidden');last=performance.now();setHud();
  });
  ui.gridToggle.addEventListener('click',()=>{
    showGrid=!showGrid;
    localStorage.setItem('clock-attack-grid',showGrid?'1':'0');
    setHud();
  });
  function updateZoom(){
    $('zoomValue').textContent=`${Math.round(cameraZoom()*100)}%`;
    $('zoomIn').disabled=zoomIndex===0;$('zoomOut').disabled=zoomIndex===zoomLevels.length-1;
  }
  $('zoomIn').addEventListener('click',()=>{zoomIndex=Math.max(0,zoomIndex-1);updateZoom()});
  $('zoomOut').addEventListener('click',()=>{zoomIndex=Math.min(zoomLevels.length-1,zoomIndex+1);updateZoom()});
  $('pauseTitleButton').addEventListener('click',()=>{$('pauseMenu').hidden=true;$('titleConfirm').hidden=false;$('confirmTitleNo').focus()});
  $('confirmTitleNo').addEventListener('click',()=>{$('titleConfirm').hidden=true;$('pauseMenu').hidden=false;$('pauseTitleButton').focus()});
  $('confirmTitleYes').addEventListener('click',()=>{location.href='index.html'});
  updateZoom();
  function restart(){
    clearTimeout(transitionTimer);energy=0;moveProgress=0;unlocked=0;sandBottles.length=0;score=0;round=activeRounds[0];roundKills=0;roundSpawned=0;roundElapsed=0;roundSpawnCounts={};swordCount=0;elapsed=0;timeSinceKill=0;damageFlash=0;grayHits=0;lowEnergyGray=false;timeScale=1;ui.speedButton.textContent='速度×1';
    ui.elapsedTime.textContent='0:00';
    ui.pauseScreen.classList.add('hidden');
    ui.clearScreen.classList.add('hidden');
    ui.killWarning.classList.add('hidden');
    enemies.length=0;deadEnemies.length=0;particles.length=0;explosions.length=0;damageNumbers.length=0;
    recoveryGaugeFrom=0;recoveryGaugeRemaining=0;
    player.x=map.width*16;player.y=map.height*16;ensurePlayerFree();invincible=0;entryGray=0;swing=0;spin=0;hitStop=0;
    objectDestruction.reset();obstacles=MapCollision.build(objectDestruction.activeMap(),collisionCatalog);renderTerrain();
    startSelection(true);
  }
  function gameClear(preview=false){
    clearTimeout(transitionTimer);cancelCharge();mode='clear';drag.pointer=null;
    ui.killWarning.classList.add('hidden');ui.overlay.classList.add('hidden');ui.pauseScreen.classList.add('hidden');
    if(preview){score=60;elapsed=183}
    ui.clearHourglass.innerHTML=hourglassSvg(['#fff8c9','#f1c553','#ffffff'],'clearSand');
    ui.clearScore.textContent=score;
    const seconds=Math.floor(elapsed);ui.clearTime.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    if(preview)ui.clearTitleLink.removeAttribute('href');else ui.clearTitleLink.href='index.html';
    ui.clearScreen.classList.remove('hidden');ui.clearScreen.classList.add('announcing');
    void ui.clearAnnouncement.offsetWidth;
    transitionTimer=setTimeout(()=>{ui.clearScreen.classList.remove('announcing');transitionTimer=null},1250);
    setHud();
  }
  ui.clearRetry.addEventListener('click',()=>{if(!clearPreviewMode)restart()});
  ui.clearTitleLink.addEventListener('click',event=>{if(clearPreviewMode)event.preventDefault()});
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
    if(particles.length>MAX_PARTICLES)particles.splice(0,particles.length-MAX_PARTICLES);
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
    const icons=unlocked,bottles=sandBottles.map(bottle=>({...bottle})),recovery=bottles.reduce((total,bottle)=>total+bottle.recovery,0);
    sandBottles.length=0;unlocked=0;setHud();startSelection(false,icons,recovery,bottles);
  }
  function movePlayer(dx,dy){
    if(mode!=='play'||energy<=0||hitStop>0)return;
    const length=Math.hypot(dx,dy);if(length<.1)return;
    player.angle=Math.atan2(dy,dx);
    const scale=Math.min(1,(energy*MOVE_DISTANCE_PER_ENERGY-moveProgress)/length),oldX=player.x,oldY=player.y;
    const bounds=playerMovementBounds();
    moveBody(player,clamp(player.x+dx*scale,bounds.left,bounds.right)-player.x,clamp(player.y+dy*scale,bounds.top,bounds.bottom)-player.y,10,14);
    moveProgress+=Math.hypot(player.x-oldX,player.y-oldY);
    const spent=Math.floor((moveProgress+1e-6)/MOVE_DISTANCE_PER_ENERGY);
    if(spent>0){moveProgress=Math.max(0,moveProgress-spent*MOVE_DISTANCE_PER_ENERGY);spendEnergy(spent)}
    checkExhausted();
  }
  function aimAt(clientX,clientY){
    if(mode!=='play'||energy<=0)return;
    const rect=canvas.getBoundingClientRect();
    const dx=((clientX-rect.left)/VIEW_SCALE-w/2)/cameraZoom(),dy=((clientY-rect.top)/VIEW_SCALE-h/2)/cameraZoom();
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
    movePlayer(dx*.8/VIEW_SCALE/cameraZoom(),dy*.8/VIEW_SCALE/cameraZoom());
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
    if(swordCount>=SPIN_SWORD_COST){
      ui.attack.classList.add('charging');
      charge.timer=setTimeout(()=>{
        if(charge.pointer!==e.pointerId||mode!=='play'||energy<=0||swordCount<SPIN_SWORD_COST)return;
        spinAttack();cancelCharge();
      },SPIN_CHARGE_SECONDS*1000/timeScale);
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
  function defeatEnemy(i,enemy){
    deadEnemies.push({...enemy,deathTime:.45});score++;roundKills++;swordCount=Math.min(MAX_SWORD_COUNT,swordCount+1);
    if(sandBottles.length<MAX_HOURGLASS_STOCK)sandBottles.push({kind:enemy.kind,color:enemy.color,recovery:enemy.hpMax*10});
    unlocked=sandBottles.length;timeSinceKill=0;ui.killWarning.classList.add('hidden');burst(enemy.x,enemy.y,enemy.color,11);
    enemies.splice(i,1);setHud();
    return enemy.deathHitStop||.1;
  }
  function finishEnemyDamage(defeated,deathHitStop=.1){
    if(defeated){hitStop=Math.max(hitStop,deathHitStop);drag.pointer=null}
    if(roundKills<roundKillTarget(round))return;
    const nextRound=activeRounds.find(number=>number>round);
    if(nextRound===undefined){gameClear();return}
    round=nextRound;roundKills=0;roundSpawned=0;roundElapsed=0;roundSpawnCounts={};spawnTimer=0;enemies.length=0;
  }
  function hitObjects(damage,fullCircle){
    const hits=objectDestruction.hit(player.x,player.y,player.angle,player.r+51,damage,fullCircle);
    for(const hit of hits){
      showDamage({...hit,r:0},damage);burst(hit.x,hit.y,hit.destroyed?'#c89860':'#fff1c3',hit.destroyed?18:8);
      explosions.push({x:hit.x,y:hit.y,r:16,life:.25,max:.25});
    }
    if(hits.some(hit=>hit.destroyed)){obstacles=MapCollision.build(objectDestruction.activeMap(),collisionCatalog);renderTerrain();}
  }
  function hitEnemies(damage,fullCircle){
    const ax=Math.cos(player.angle),ay=Math.sin(player.angle);
    let defeated=false,deathHitStop=0;
    for(let i=enemies.length-1;i>=0;i--){
      const enemy=enemies[i],dx=enemy.x-player.x,dy=enemy.y-player.y,len=Math.hypot(dx,dy);
      if(len>=player.r+enemy.r+51||(!fullCircle&&len>=25&&(dx*ax+dy*ay)/len<=-.2))continue;
      const knockAngle=len>0?Math.atan2(dy,dx):player.angle;
      if(enemy.knockback)moveBody(enemy,Math.cos(knockAngle)*enemy.knockbackDistance,Math.sin(knockAngle)*enemy.knockbackDistance,enemy.r);
      enemy.hp-=damage;enemy.hit=.18;
      explosions.push({x:enemy.x,y:enemy.y,r:enemy.r,life:.45,max:.45});
      burst(enemy.x,enemy.y,'#fff1c3',15);showDamage(enemy,damage);
      if(enemy.hp>0)continue;
      defeated=true;deathHitStop=Math.max(deathHitStop,defeatEnemy(i,enemy));
    }
    finishEnemyDamage(defeated,deathHitStop);
  }
  function instantKillAll(){
    if(mode!=='play'||hitStop>0||enemies.length===0)return;
    let defeated=false,deathHitStop=0;
    for(let i=enemies.length-1;i>=0;i--){
      const enemy=enemies[i];enemy.hp-=100;enemy.hit=.18;
      explosions.push({x:enemy.x,y:enemy.y,r:enemy.r,life:.45,max:.45});
      burst(enemy.x,enemy.y,'#fff1c3',15);showDamage(enemy,100);
      if(enemy.hp<=0){defeated=true;deathHitStop=Math.max(deathHitStop,defeatEnemy(i,enemy))}
    }
    finishEnemyDamage(defeated,deathHitStop);setHud();
  }
  ui.instantKillButton.addEventListener('click',instantKillAll);
  ui.speedButton.addEventListener('click',()=>{
    if(mode!=='play')return;
    timeScale=timeScale===1?1.5:timeScale===1.5?2:1;
    ui.speedButton.textContent=`速度×${timeScale}`;
  });
  function attack(){
    if(mode!=='play'||energy<=0||swing>0||spin>0||hitStop>0)return;
    const damage=attackDamage(swordCount);
    spendEnergy(1);swing=.27;swingAngle=player.angle;swingScale=attackEffectScale(damage);
    hitObjects(damage,false);hitEnemies(damage,false);
    setHud();checkExhausted();
  }
  function spinAttack(){
    if(mode!=='play'||energy<=0||swordCount<SPIN_SWORD_COST||swing>0||spin>0||hitStop>0)return;
    const damage=Math.max(SPIN_MIN_DAMAGE,attackDamage(swordCount));
    swordCount-=SPIN_SWORD_COST;spin=.55;swingAngle=player.angle;spinScale=attackEffectScale(damage);
    hitObjects(damage,true);hitEnemies(damage,true);
    setHud();checkExhausted();
  }
  function spawn(){
    if(roundSpawned>=roundKillTarget(round)||enemies.length>=MAX_ENEMIES)return;
    const config=currentRoundConfig(round),rules=Array.isArray(config.spawns)?config.spawns:[];
    let rule=null,type=null;
    if(rules.length){
      const eligible=rules.filter(candidate=>{
        const candidateType=SLIME_BY_KEY[candidate.enemy_key];if(!enemyData[candidate.enemy_key]||!candidateType||roundElapsed<Number(candidate.start_elapsed_seconds||0))return false;
        if(Number(candidate.max_alive||0)>0&&enemies.filter(enemy=>enemy.enemyKey===candidate.enemy_key).length>=Number(candidate.max_alive))return false;
        return !(Number(candidate.max_per_round||0)>0&&Number(roundSpawnCounts[candidate.enemy_key]||0)>=Number(candidate.max_per_round));
      });
      const guaranteed=eligible.find(candidate=>candidate.guaranteed_once&&!roundSpawnCounts[candidate.enemy_key]);
      const total=eligible.reduce((sum,candidate)=>sum+Number(candidate.spawn_weight||0),0);let pick=Math.random()*total;
      rule=guaranteed||eligible.find(candidate=>(pick-=Number(candidate.spawn_weight||0))<=0)||eligible[eligible.length-1];
      type=rule?SLIME_BY_KEY[rule.enemy_key]:null;
    }
    if(!type)return;
    const hp=Math.max(1,Math.round(type.hp*setting(config,'enemy_hp_multiplier',1))),attack=Math.max(0,type.attack*setting(config,'enemy_attack_multiplier',round)),r=type.radius;
    const point=WorldSpawn.around(player.x,player.y,320,map.width*32,map.height*32,r,obstacles);
    if(!point)return;
    const {x,y}=point;
    enemies.push({x,y,r,hp,hpMax:hp,enemyKey:type.enemyKey,kind:type.kind,attack,deathHitStop:type.deathHitStop,knockback:type.knockback!==false,knockbackDistance:type.knockbackDistance,color:type.color,speed:(type.enemyKey==='slime_blue'?blueSlimeTuning.moveSpeed:21+Math.random()*12+score*.3)*setting(config,'enemy_speed_multiplier',1),hit:0,wobble:Math.random()*6.28,animationTime:Math.random()*BLUE_SLIME_LOOP_SECONDS,attackTime:0,attackAngle:0});
    roundSpawned++;roundSpawnCounts[type.enemyKey]=(roundSpawnCounts[type.enemyKey]||0)+1;
  }
  function update(dt){
    if(mode==='entry'){
      entryGray=Math.max(0,entryGray-dt);
      recoveryGaugeRemaining=Math.max(0,recoveryGaugeRemaining-dt);
      if(entryGray===0&&recoveryGaugeRemaining===0)mode='play';
      setHud();
      return;
    }
    if(mode==='refill-entry'){
      recoveryGaugeRemaining=Math.max(0,recoveryGaugeRemaining-dt);
      if(recoveryGaugeRemaining===0)mode='play';
      setHud();return;
    }
    if(mode!=='play')return;
    if(hitStop>0){hitStop=Math.max(0,hitStop-dt);updateHitEffects(dt);return}
    const previousSecond=Math.floor(elapsed);
    elapsed+=dt;roundElapsed+=dt;
    if(score>0)timeSinceKill+=dt;
    if(score>0&&timeSinceKill>=IDLE_WARNING_SECONDS){
      const countdown=Math.ceil(IDLE_WARNING_SECONDS+GAME_OVER_COUNTDOWN_SECONDS-timeSinceKill);
      if(countdown<=0){gameOver('no-kill');return}
      ui.killCountdown.textContent=countdown;
      ui.killWarning.classList.remove('hidden');
    }
    if(Math.floor(elapsed)!==previousSecond){
      const seconds=Math.floor(elapsed);
      ui.elapsedTime.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    }
    let dx=0,dy=0;
    if(keys.has('ArrowLeft')||keys.has('KeyA'))dx--;
    if(keys.has('ArrowRight')||keys.has('KeyD'))dx++;
    if(keys.has('ArrowUp')||keys.has('KeyW'))dy--;
    if(keys.has('ArrowDown')||keys.has('KeyS'))dy++;
    const length=Math.hypot(dx,dy);
    if(length){movePlayer(dx/length*124*dt,dy/length*124*dt);if(mode!=='play')return}
    spawnTimer+=dt;
    if(spawnTimer>=setting(currentRoundConfig(round),'spawn_interval_seconds',1)){spawnTimer=0;spawn()}
    invincible=Math.max(0,invincible-dt);damageFlash=Math.max(0,damageFlash-dt);ui.energyBar.classList.toggle('hit',damageFlash>0);
    swing=Math.max(0,swing-dt);spin=Math.max(0,spin-dt);shake=Math.max(0,shake-dt);
    for(const enemy of enemies){
      enemy.wobble+=dt*5;if(enemy.enemyKey==='slime_blue'&&enemy.attackTime<=0)enemy.animationTime=(enemy.animationTime+dt)%BLUE_SLIME_LOOP_SECONDS;enemy.hit=Math.max(0,enemy.hit-dt);enemy.attackTime=Math.max(0,(enemy.attackTime||0)-dt);
      const ex=player.x-enemy.x,ey=player.y-enemy.y,len=Math.hypot(ex,ey)||1;
      if(enemy.attackTime<=0)moveBody(enemy,ex/len*enemy.speed*dt,ey/len*enemy.speed*dt,enemy.r);
      if(len<player.r+enemy.r-3&&invincible<=0){
        enemy.attackTime=enemy.enemyKey==='slime_blue'?BLUE_ATTACK_DURATION:SLIME_ATTACK_DURATION;enemy.attackAngle=Math.atan2(ey,ex);
        damageFlash=.5;
        const bounds=playerMovementBounds();
        moveBody(player,clamp(player.x+ex/len*Math.max(0,setting(playerData,'damage_knockback_distance_px',20)),bounds.left,bounds.right)-player.x,clamp(player.y+ey/len*Math.max(0,setting(playerData,'damage_knockback_distance_px',20)),bounds.top,bounds.bottom)-player.y,10,14);
        if(energy===0&&unlocked>0){grayHits=Math.min(3,grayHits+1);setHud()}
        else spendEnergy(enemy.attack);
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
    const size=50*SWORD_SCALE;
    ctx.drawImage(swordImage,-size/2,-44*SWORD_SCALE,size,size);
    ctx.restore();
  }
  function draw(now){
    ctx.clearRect(0,0,w,h);ctx.save();
    ctx.fillStyle='#447a45';ctx.fillRect(0,0,w,h);
    ctx.translate(w/2,h/2);ctx.scale(cameraZoom(),cameraZoom());ctx.translate(-player.x,-player.y);
    if(shake>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*5);
    if(terrainCanvas){ctx.imageSmoothingEnabled=false;ctx.drawImage(terrainCanvas,terrainOrigin.x,terrainOrigin.y);ctx.imageSmoothingEnabled=true}
    else{ctx.fillStyle='#447a45';ctx.fillRect(0,0,w,h)}
    if(showGrid){
      const size=mapTools.tileSize,left=0,top=0;
      ctx.save();ctx.strokeStyle='#f6f1d399';ctx.lineWidth=1/VIEW_SCALE;ctx.beginPath();
      for(let x=0;x<=map.width;x++){const px=left+x*size;ctx.moveTo(px,top);ctx.lineTo(px,top+map.height*size)}
      for(let y=0;y<=map.height;y++){const py=top+y*size;ctx.moveTo(left,py);ctx.lineTo(left+map.width*size,py)}
      ctx.stroke();ctx.restore();
    }
    ctx.save();ctx.strokeStyle='#fff2b6';ctx.lineWidth=2;ctx.strokeRect(0,0,map.width*32,map.height*32);ctx.restore();
    for(const enemy of [...enemies,...deadEnemies]){
      const dying=enemy.deathTime!==undefined;
      if(dying&&Math.floor(now/55)%2===0)continue;
      const y=enemy.y+Math.sin(enemy.wobble)*2;
      const blueFrame=enemy.enemyKey==='slime_blue'?blueSlimeFrame(enemy):null;
      const blueImageReady=!!blueFrame?.image.complete&&blueFrame.image.naturalWidth>0;
      if(blueImageReady){
        const spriteSize=56;
        ctx.save();ctx.translate(enemy.x,y);if(blueFrame.attack&&Math.cos(enemy.attackAngle||0)<0)ctx.scale(-1,1);ctx.imageSmoothingEnabled=false;
        ctx.drawImage(blueFrame.image,-spriteSize/2,-spriteSize/2,spriteSize,spriteSize);ctx.restore();ctx.imageSmoothingEnabled=true;
        if(enemy.hit>0&&blueFrame.flash){
          ctx.save();ctx.globalAlpha=clamp(enemy.hit/.18,0,.9);
          ctx.drawImage(blueFrame.flash,enemy.x-spriteSize/2,y-spriteSize/2,spriteSize,spriteSize);ctx.restore();
        }
      }else{
        const attacking=!dying&&enemy.attackTime>0,attackProgress=attacking?1-enemy.attackTime/SLIME_ATTACK_DURATION:0;
        let stretchX=1,stretchY=1,lunge=0;
        if(attacking){
          if(attackProgress<.25){const p=attackProgress/.25;stretchX=1+.22*p;stretchY=1-.22*p;lunge=-2*p}
          else if(attackProgress<.5){const p=(attackProgress-.25)/.25;stretchX=1.22-.42*p;stretchY=.78+.42*p;lunge=-2+8*p}
          else if(attackProgress<.75){const p=(attackProgress-.5)/.25;stretchX=.8+.32*p;stretchY=1.2-.3*p;lunge=6+4*p}
          else{const p=(attackProgress-.75)/.25;stretchX=1.12-.12*p;stretchY=.9+.1*p;lunge=10*(1-p)}
        }
        ctx.save();ctx.translate(enemy.x,y);ctx.translate(Math.cos(enemy.attackAngle||0)*lunge,Math.sin(enemy.attackAngle||0)*lunge);ctx.scale(stretchX,stretchY);
        ctx.fillStyle='#0b172277';ctx.beginPath();ctx.ellipse(0,enemy.r*.8,enemy.r,5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=enemy.hit>0?'#fff':enemy.color;ctx.beginPath();ctx.arc(0,0,enemy.r,Math.PI,0);
        ctx.quadraticCurveTo(enemy.r,enemy.r*.85,0,enemy.r*.7);
        ctx.quadraticCurveTo(-enemy.r,enemy.r*.85,-enemy.r,0);ctx.fill();
        ctx.fillStyle='#24333b';ctx.beginPath();ctx.arc(-5,-2,2,0,7);ctx.arc(5,-2,2,0,7);ctx.fill();ctx.restore();
      }
      if(dying)continue;
      const barW=Math.max(34,enemy.r*2),barX=enemy.x-barW/2,barY=y-(blueImageReady?56/2:enemy.r)-12;
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
    if(swing>0){ctx.strokeStyle=`rgba(255,224,158,${swing/.27})`;ctx.lineWidth=12*swingScale;ctx.lineCap='round';ctx.beginPath();ctx.arc(player.x,player.y,49*swingScale,swingAngle-.95,swingAngle+.95);ctx.stroke()}
    if(spin>0){
      const progress=1-spin/.55,angle=swingAngle+progress*Math.PI*2;
      ctx.strokeStyle=`rgba(255,214,133,${spin/.55})`;ctx.lineWidth=13*spinScale;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(player.x,player.y,53*spinScale,angle-1.1,angle+1.1);ctx.stroke();
      ctx.strokeStyle=`rgba(255,245,210,${spin/.55*.65})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(player.x,player.y,53*spinScale,0,Math.PI*2);ctx.stroke();
    }
    ctx.globalAlpha=invincible>0&&Math.floor(now/90)%2?.4:1;
    ctx.fillStyle='#111d26aa';ctx.beginPath();ctx.ellipse(player.x,player.y+14,17,6,0,0,7);ctx.fill();
    const direction=((Math.round((player.angle+Math.PI/2)/(Math.PI/4))%8)+8)%8;
    const sprite=playerSprites[direction],graySprite=playerSpritesGray[direction];
    if(sprite){
      const height=56*PLAYER_SCALE,width=height*sprite.width/sprite.height;
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
    if(auraDamage>BASE_ATTACK_DAMAGE){
      const color=auraDamage===RED_AURA_DAMAGE?'#ff554d':'#f7fbff';
      ctx.save();ctx.strokeStyle=color;ctx.lineWidth=auraDamage===RED_AURA_DAMAGE?4:3;
      ctx.shadowColor=color;ctx.shadowBlur=18+Math.sin(now/150)*4;
      ctx.globalAlpha=.8+Math.sin(now/180)*.13;
      ctx.beginPath();ctx.ellipse(player.x,player.y-5,26,31,0,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.3;ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(player.x,player.y-5,31,36,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    if(swing>0){
      const progress=1-swing/.27;
      drawSword(swingAngle-.95+progress*1.9,49*swingScale,Math.min(1,swing/.055));
    }
    if(spin>0){
      const progress=1-spin/.55;
      drawSword(swingAngle+progress*Math.PI*2,53*spinScale,Math.min(1,spin/.075));
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
    const dt=Math.min((now-last)/1000,.05)*timeScale;last=now;
    if(charge.pointer!==null&&charge.timer!==null)ui.attack.style.setProperty('--charge',`${Math.min(100,(now-charge.start)*timeScale/(SPIN_CHARGE_SECONDS*10))}%`);
    update(dt);draw(now);requestAnimationFrame(frame);
  }
  function startEffectPreview(){
    const requested=Number(new URLSearchParams(location.search).get('stock'))||5;
    const count=Math.max(1,Math.min(MAX_HOURGLASS_STOCK,Math.round(requested)));
    const palette=['blue','green','red','purple','black','metal'];
    const previewKinds=Array.from({length:count},(_,i)=>palette[i%palette.length]);
    const previewBottles=previewKinds.map(kind=>({kind,color:SLIME_TYPES[kind].color,recovery:SLIME_TYPES[kind].hp*10}));
    startSelection(false,previewBottles.length,previewBottles.reduce((total,bottle)=>total+bottle.recovery,0),previewBottles);
  }
  if(clearPreviewMode)gameClear(true);else if(effectPreviewMode)startEffectPreview();else startSelection(true);
  requestAnimationFrame(frame);
})();
