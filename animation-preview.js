(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const home=$('home'),previewScreen=$('previewScreen'),gameFrame=$('gameFrame'),canvas=$('assetCanvas'),ctx=canvas.getContext('2d');
  const hint=$('hint'),panel=$('debugPanel'),subChoices=$('subChoices'),fileList=$('fileList'),loopToggle=$('loopToggle'),tuningPanel=$('tuning'),rangePanel=$('rangePanel');
  const moveSpeedInput=$('moveSpeed'),moveSpeedOutput=$('moveSpeedValue');
  const enemySelect=$('enemySelect'),enemyPicker=$('enemyPicker'),enemySearch=$('enemySearch'),enemySearchStatus=$('enemySearchStatus');
  let enemyKey='slime_blue',enemyManifest={},enemyMasterData={},enemyLoadVersion=0;
  const storageKey=()=>enemyKey==='slime_blue'?'clock-attack-blue-slime-tuning-v1':`clock-attack-enemy-tuning-v1:${enemyKey}`;
  const defaults={moveSpeed:27,idleTime:.38,midTime:.12,peakTime:.12};
  let tuningEdited=false;
  let tuning=readTuning(),category='',action='',selection=0,loop=false,startedAt=performance.now(),canvasWidth=0,canvasHeight=0,dpr=1,actorImages=[],swordImage=null;
  let enemyMoveImages=[],enemyAttackImages=[];
  const moveSettings=$('moveSettings'),attackSettings=$('attackSettings');
  const attackFrameDefault=.105;
  const rangeDefaults={normal:{range_px:42,angle_degrees:182},spin:{range_px:42,angle_degrees:360},object:{range_px:42,angle_degrees:203}};
  let rangeMaster={},rangeOwner='player',rangeSettings={},rangeMode='normal',rangeTarget=null,rangePlayerAngle=0,rangeStrikeStartedAt=0,rangeStrikeUntil=0,rangeStrikeHit=false,rangeGrid=true,rangeLoadVersion=0;
  const menuButtons=[...document.querySelectorAll('[data-category]')];
  const rangeStorageKey=()=>`clock-attack-range-preview-v3:${rangeOwner}:${rangeOwner==='player'?'player':enemyKey}`;
  const rangeLabel=mode=>({normal:'通常攻撃',spin:'回転斬り',object:'オブジェクト',contact:'接触攻撃'})[mode]||mode;
  function readRangeSettings(){const master=rangeMaster[rangeOwner]?.[rangeOwner==='player'?'player':enemyKey]||(rangeOwner==='player'?rangeDefaults:{});try{return {...structuredClone(master),...JSON.parse(localStorage.getItem(rangeStorageKey())||'{}')}}catch{return structuredClone(master)}}
  function rangeAttackDuration(){return rangeOwner==='enemy'?Math.max(40,enemyAttackImages.reduce((sum,_,i)=>sum+attackTime(i)*1000,0)||420):rangeMode==='spin'?550:270}
  function refreshRangeControls(){
    const settings=rangeSettings[rangeMode],available=!!settings;
    $('rangeModes').replaceChildren();
    for(const mode of Object.keys(rangeSettings)){const b=document.createElement('button');b.type='button';b.className='sub-choice'+(mode===rangeMode?' active':'');b.textContent=rangeLabel(mode);b.addEventListener('click',()=>{rangeMode=mode;rangeStrikeUntil=0;refreshRangeControls()});$('rangeModes').append(b)}
    $('rangeDistance').disabled=$('rangeAngle').disabled=$('rangeAttackTest').disabled=$('copyRangeSettings').disabled=!available;
    $('rangeDistance').value=String(settings?.range_px||0);$('rangeDistanceLabel').textContent=rangeLabel(rangeMode)+'の距離';$('rangeDistanceValue').textContent=available?settings.range_px+' px':'設定なし';
    $('rangeAngle').value=String(settings?.angle_degrees||0);$('rangeAngleLabel').textContent=rangeLabel(rangeMode)+'の角度';$('rangeAngleValue').textContent=available?settings.angle_degrees+'°':'設定なし';
    $('rangeFacingLabel').textContent=rangeOwner==='enemy'?'エネミーの向き':'プレイヤーの向き';
    $('rangeOwnerPlayer').classList.toggle('active',rangeOwner==='player');$('rangeOwnerEnemy').classList.toggle('active',rangeOwner==='enemy');
    $('rangeHelp').textContent=rangeOwner==='enemy'?`${enemyKey}の攻撃範囲です。プレイヤーをドラッグして位置を調整します。設定のない敵はattack_rangeへ登録してください。`:'エネミーをドラッグして位置を調整します。';
    $('rangeHitStatus').textContent=available?(rangeTargetIsHit()?'命中範囲内':'範囲外'):'このエネミーの有効な攻撃範囲設定がありません';
    draw();
  }
  function resetRangeSettings(){rangeSettings=readRangeSettings();if(!rangeSettings[rangeMode])rangeMode=rangeSettings.normal?'normal':Object.keys(rangeSettings)[0]||'normal';rangeStrikeUntil=0;refreshRangeControls()}
  function saveRangeSettings(){if(!rangeSettings[rangeMode])return;rangeSettings[rangeMode]={range_px:Number($('rangeDistance').value),angle_degrees:Number($('rangeAngle').value)};localStorage.setItem(rangeStorageKey(),JSON.stringify(rangeSettings));refreshRangeControls()}
  async function loadMasterRangeSettings(){
    const version=++rangeLoadVersion;
    try{const response=await fetch('game-data.json',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(version!==rangeLoadVersion)return;rangeMaster=data.attack_range||{};enemyMasterData=data.enemies||{};localStorage.removeItem(rangeStorageKey());resetRangeSettings();$('rangeNotice').textContent='ゲームデータのattack_range設定を読み込みました'}catch{if(version===rangeLoadVersion)$('rangeNotice').textContent='attack_range設定を読み込めませんでした。CSV出力を確認してください'}
  }
  $('rangeOwnerPlayer').addEventListener('click',()=>{rangeOwner='player';resetRangeSettings()});$('rangeOwnerEnemy').addEventListener('click',()=>{rangeOwner='enemy';resetRangeSettings()});
  $('rangeDistance').addEventListener('input',saveRangeSettings);$('rangeAngle').addEventListener('input',saveRangeSettings);$('rangeFacing').addEventListener('input',e=>{rangePlayerAngle=Number(e.target.value)*Math.PI/180;$('rangeFacingValue').textContent=e.target.value+'°';draw()});$('rangeGridToggle').addEventListener('change',e=>{rangeGrid=e.target.checked;draw()});$('loadRangeSettings').addEventListener('click',loadMasterRangeSettings);
  $('copyRangeSettings').addEventListener('click',async()=>{const payload=JSON.stringify(Object.entries(rangeSettings).map(([action,settings])=>({enabled:1,owner_type:rangeOwner,owner_key:rangeOwner==='player'?'player':enemyKey,action,...settings})),null,2);try{await navigator.clipboard.writeText(payload);$('rangeNotice').textContent='調整値をコピーしました'}catch{$('rangeNotice').textContent=payload}});
  $('rangeAttackTest').addEventListener('click',()=>{if(!rangeSettings[rangeMode])return;rangeStrikeHit=rangeTargetIsHit();rangeStrikeStartedAt=performance.now();rangeStrikeUntil=rangeStrikeStartedAt+rangeAttackDuration();$('rangeHitStatus').textContent=rangeStrikeHit?'命中':'空振り（範囲外）';$('rangeHitStatus').style.color=rangeStrikeHit?'#9ef0a8':'#ff9c91';draw()});
  canvas.addEventListener('pointerdown',e=>{if(category!=='attackRange'||action!=='player')return;e.preventDefault();canvas.setPointerCapture(e.pointerId);moveRangeTarget(e)});canvas.addEventListener('pointermove',e=>{if(category==='attackRange'&&action==='player'&&canvas.hasPointerCapture(e.pointerId))moveRangeTarget(e)});
  function moveRangeTarget(e){const r=canvas.getBoundingClientRect();rangeTarget={x:(e.clientX-r.left)*canvasWidth/r.width,y:(e.clientY-r.top)*canvasHeight/r.height};rangeStrikeUntil=0;refreshRangeControls()}
  function rangeTargetIsHit(){if(!rangeTarget||!canvasWidth||!canvasHeight)return false;const scale=48/32,enemyRadius=AttackRange.enemyRadius(enemyKey,enemyMasterData[enemyKey]),attackerRadius=rangeOwner==='enemy'?enemyRadius:14,targetRadius=rangeOwner==='enemy'?14:enemyRadius;return AttackRange.contains({x:canvasWidth/2/scale,y:canvasHeight/2/scale,r:attackerRadius,angle:rangePlayerAngle},{x:rangeTarget.x/scale,y:rangeTarget.y/scale,r:targetRadius},rangeSettings[rangeMode],rangeOwner==='enemy'&&rangeMode==='contact')}
  function readTuning(){
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey())||'{}');
      const master=masterTuning();
      return {...master,...saved,moveTimes:Array.isArray(saved.moveTimes)?saved.moveTimes:master.moveTimes,attackTimes:Array.isArray(saved.attackTimes)?saved.attackTimes:master.attackTimes};
    }catch{return masterTuning()}
  }
  function moveTime(index){
    const value=Number(tuning.moveTimes[index]);
    const fallback=[tuning.idleTime,tuning.midTime,tuning.peakTime,tuning.midTime][index]??tuning.midTime;
    return Number.isFinite(value)&&value>0?Math.max(.04,Math.min(1.2,value)):fallback;
  }
  function buildFrameSettings(container,frames,actionName,timeFor){
    container.replaceChildren();
    frames.forEach((frame,index)=>{
      const row=document.createElement('div'),label=document.createElement('label'),output=document.createElement('output'),input=document.createElement('input');
      row.className='slider-row';label.htmlFor=`${actionName}Time${index}`;label.textContent=`画像${index+1}の速度`;
      input.id=label.htmlFor;input.type='range';input.min='.04';input.max=actionName==='move'?'1.20':'.50';input.step='.01';input.value=String(timeFor(index));
      output.textContent=`${Number(input.value).toFixed(2)} s`;
      input.addEventListener('input',()=>{
        tuning[actionName+'Times'][index]=Number(input.value);output.textContent=`${Number(input.value).toFixed(2)} s`;
        tuningEdited=true;localStorage.setItem(storageKey(),JSON.stringify(tuning));startedAt=performance.now();draw();
      });
      row.append(label,output,input);container.append(row);
    });
  }
  function attackTime(index){
    const value=Number(tuning.attackTimes[index]);
    return Number.isFinite(value)&&value>0?Math.max(.04,Math.min(.5,value)):attackFrameDefault;
  }
  function buildAttackSettings(){buildFrameSettings(attackSettings,enemyAttackImages,'attack',attackTime)}
  function buildMoveSettings(){buildFrameSettings(moveSettings,enemyMoveImages,'move',moveTime)}
  moveSpeedInput.value=String(tuning.moveSpeed);
  function saveTuning(){
    tuningEdited=true;
    tuning.moveSpeed=Number(moveSpeedInput.value);
    localStorage.setItem(storageKey(),JSON.stringify(tuning));
    updateOutputs();draw();
  }
  function updateOutputs(){
    moveSpeedOutput.textContent=tuning.moveSpeed+' px/s';
  }
  moveSpeedInput.addEventListener('input',saveTuning);
  updateOutputs();
  function masterTuning(){
    const enemy=enemyMasterData[enemyKey]||{};
    const result={...defaults,moveTimes:[],attackTimes:[]};
    const values={moveSpeed:enemy.move_speed_px_per_second,idleTime:enemy.animation_idle_seconds,midTime:enemy.animation_jump_mid_seconds,peakTime:enemy.animation_jump_peak_seconds};
    for(const [key,value] of Object.entries(values))if(value!=null&&Number.isFinite(Number(value)))result[key]=Math.max(key==='moveSpeed'?0:.04,Math.min(key==='moveSpeed'?80:1.2,Number(value)));
    if(enemyKey!=='slime_blue')result.idleTime=result.midTime=result.peakTime=.12;
    if(Array.isArray(enemy.animation_move_frame_seconds))result.moveTimes=[...enemy.animation_move_frame_seconds];
    if(Array.isArray(enemy.animation_attack_frame_seconds))result.attackTimes=[...enemy.animation_attack_frame_seconds];
    return result;
  }
  function refreshTuning(){moveSpeedInput.value=String(tuning.moveSpeed);buildMoveSettings();buildAttackSettings();updateOutputs();startedAt=performance.now();draw()}
  fetch('game-data.json',{cache:'no-store'}).then(response=>{
    if(!response.ok)throw new Error('HTTP '+response.status);
    return response.json();
  }).then(data=>{
    enemyMasterData=data.enemies||{};loadPlayerImages(data.assets||[]);rangeMaster=data.attack_range||{};
    if(!tuningEdited&&!localStorage.getItem(storageKey())){tuning=masterTuning();refreshTuning()}
  }).catch(()=>{$('notice').textContent='ゲームデータを読み込めないため初期値を表示しています'});
  $('loadDataSettings').addEventListener('click',async()=>{
    const requestedKey=enemyKey;
    try{
      const response=await fetch('game-data.json',{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();enemyMasterData=data.enemies||{};
      if(enemyKey!==requestedKey)return;
      tuning=masterTuning();tuningEdited=true;
      localStorage.setItem(storageKey(),JSON.stringify(tuning));refreshTuning();
      $('notice').textContent=`ゲームデータの${enemyKey}設定を読み込みました`;
    }catch{if(enemyKey===requestedKey)$('notice').textContent='game-data.jsonを読み込めませんでした'}
  });
  function loadSprite(file,index){
    return new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{
        resolve({file,label:file,image});
      };
      image.onerror=()=>resolve({file,label:file,image:null});
      image.src=file;
    });
  }
  function loadImage(file,label){
    return new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>resolve({file,label,image});
      image.onerror=()=>resolve({file,label,image:null});
      image.src=file==='sword.svg'?'design/sword.svg':`${label}?sprite=1.07`;
    });
  }
  async function selectEnemy(key){
    const version=++enemyLoadVersion;
    enemyKey=key;enemySelect.value=key;selection=0;tuningEdited=false;tuning=readTuning();if(category==='attackRange')resetRangeSettings();
    enemyMoveImages=[];enemyAttackImages=[];$('notice').textContent='画像を読み込んでいます';
    refreshTuning();buildFileList();
    const files=enemyManifest[key]||{},moves=Array.isArray(files.move)?files.move:[],attacks=Array.isArray(files.attack)?files.attack:[];
    const [moveImages,attackImages]=await Promise.all([
      Promise.all(moves.map(path=>loadImage(path.split('/').pop(),path))),
      Promise.all(attacks.map(path=>loadImage(path.split('/').pop(),path)))
    ]);
    if(version!==enemyLoadVersion)return;
    enemyMoveImages=moveImages;enemyAttackImages=attackImages;
    $('notice').textContent=[...moveImages,...attackImages].some(item=>!item.image)?'読み込めない画像があります。画像一覧のパスを確認してください':'';
    refreshTuning();buildFileList();draw();
  }
  function filterEnemyOptions(){
    const keywords=enemySearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const keys=Object.keys(enemyManifest).sort().filter(key=>keywords.every(word=>key.toLowerCase().includes(word)));
    enemySelect.replaceChildren();
    if(!keys.includes(enemyKey)){
      const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=keys.length?'敵を選択してください':'該当するエネミーがありません';placeholder.disabled=true;enemySelect.append(placeholder);
    }
    for(const key of keys){const option=document.createElement('option');option.value=key;option.textContent=key;enemySelect.append(option)}
    enemySelect.value=keys.includes(enemyKey)?enemyKey:'';enemySelect.disabled=!keys.length;
    enemySearchStatus.textContent=`${keys.length}件`;
  }
  enemySearch.addEventListener('input',filterEnemyOptions);
  enemySelect.addEventListener('change',()=>{if(enemySelect.value)selectEnemy(enemySelect.value)});
  let playerImageLoad=0;
  async function loadPlayerImages(assetRows){
    const version=++playerImageLoad,files=ClockAttackAssets.create(assetRows).playerFiles();
    const items=await Promise.all(files.map((file,i)=>file?loadSprite(file,i):Promise.resolve({file:'',label:ClockAttackAssets.directions[i],image:null})));
    if(version!==playerImageLoad)return;
    actorImages=items;buildFileList();draw();
  }
  loadImage('sword.svg','sword.svg').then(item=>{swordImage=item;buildFileList();draw()});
  fetch('animation-manifest.json',{cache:'no-store'}).then(response=>{
    if(!response.ok)throw new Error('HTTP '+response.status);
    return response.json();
  }).then(manifest=>{
    enemyManifest=manifest.enemies||{};
    const keys=Object.keys(enemyManifest).sort();
    filterEnemyOptions();
    if(keys.length)return selectEnemy(keys.includes(enemyKey)?enemyKey:keys[0]);
    $('notice').textContent='確認できる敵画像がありません。画像を追加して画像一覧を更新してください';
  }).catch(()=>{enemySelect.disabled=true;$('notice').textContent='animation-manifest.jsonを読み込めませんでした'});
  function setCanvasSize(){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    dpr=Math.max(1,Math.min(2,devicePixelRatio||1));canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    canvasWidth=rect.width;canvasHeight=rect.height;ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  }
  new ResizeObserver(setCanvasSize).observe(canvas);
  function showRangePreview(){action='player';rangeOwner='player';rangeMode='normal';rangeTarget=null;rangeStrikeUntil=0;resetRangeSettings();gameFrame.classList.remove('active');gameFrame.removeAttribute('src');canvas.classList.add('active');hint.hidden=true;fileList.hidden=true;loopToggle.closest('.loop-row').hidden=true;tuningPanel.hidden=true;rangePanel.hidden=false;rangeGrid=$('rangeGridToggle').checked;setCanvasSize();rangeTarget={x:canvasWidth/2+canvasWidth*.22,y:canvasHeight/2};refreshRangeControls();loadMasterRangeSettings();$('rangeHitStatus').textContent='エネミーをドラッグして位置を調整します'}
  function showCategory(next){
    category=next;action='';selection=0;startedAt=performance.now();enemyPicker.hidden=next!=='enemy'&&next!=='attackRange';
    menuButtons.forEach(button=>button.classList.toggle('active',button.dataset.category===next));
    home.classList.remove('active');previewScreen.classList.add('active');panel.hidden=false;
    gameFrame.classList.remove('active');canvas.classList.remove('active');hint.hidden=false;
    hint.textContent='演出を選択してください';
    subChoices.replaceChildren();fileList.replaceChildren();fileList.hidden=true;loopToggle.closest('.loop-row').hidden=true;tuningPanel.hidden=true;rangePanel.hidden=true;
    if(next==='attackRange'){
      $('debugTitle').textContent='攻撃範囲';
      hint.textContent='攻撃の種類を選び、スライダーで範囲を調整します';
      showRangePreview();
    }else if(next==='hourglass'){
      $('debugTitle').textContent='砂時計の演出';
      hint.textContent='瓶の数を選ぶと、その演出を再生します';
      [1,5,7,10].forEach(count=>addSubChoice(count+'個',()=>playGame('effectPreview=1&stock='+count)));
    }else if(next==='victory'){
      $('debugTitle').textContent='勝利演出';
      hint.textContent='ボタンを押して勝利演出を再生します';
      addSubChoice('勝利演出を再生',()=>playGame('clearPreview=1'));
    }else{
      $('debugTitle').textContent=next==='player'?'プレイヤー':'エネミー';
      hint.textContent='移動または攻撃を選択してください';
      addSubChoice('移動',()=>showAction('move'));
      addSubChoice('攻撃',()=>showAction('attack'));
    }
  }
  function showHome(){
    gameFrame.classList.remove('active');gameFrame.removeAttribute('src');
    canvas.classList.remove('active');previewScreen.classList.remove('active');
    panel.hidden=true;home.classList.add('active');
    menuButtons.forEach(button=>button.classList.remove('active'));
    category='';action='';
  }
  $('backToList').addEventListener('click',showHome);
  function addSubChoice(label,callback){
    const button=document.createElement('button');button.type='button';button.className='sub-choice';button.textContent=label;
    button.addEventListener('click',()=>{subChoices.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));callback()});
    subChoices.append(button);
  }
  function playGame(query){
    hint.hidden=true;canvas.classList.remove('active');gameFrame.classList.add('active');gameFrame.src='game.html?'+query;
  }
  function showAction(next){
    action=next;selection=0;loop=loopToggle.checked;startedAt=performance.now();
    if(category==='enemy'&&next==='attack'){loop=true;loopToggle.checked=true}
    gameFrame.classList.remove('active');gameFrame.removeAttribute('src');canvas.classList.add('active');hint.hidden=true;
    fileList.hidden=false;loopToggle.closest('.loop-row').hidden=false;
    tuningPanel.hidden=category!=='enemy';rangePanel.hidden=true;
    document.querySelectorAll('.move-setting').forEach(row=>row.hidden=next==='attack');
    moveSettings.hidden=next==='attack';
    attackSettings.hidden=next!=='attack';
    buildFileList();setCanvasSize();draw();
  }
  function filesForSelection(){
    if(category==='player'&&action==='move')return actorImages.slice(0,8);
    if(category==='player'&&action==='attack')return [swordImage].filter(Boolean);
    if(category==='enemy')return action==='attack'?enemyAttackImages:enemyMoveImages;
    return [];
  }
  function buildFileList(){
    if(!fileList)return;
    fileList.replaceChildren();
    const files=filesForSelection();
    files.forEach((item,index)=>{
      if(!item)return;
      const button=document.createElement('button');button.type='button';button.className='file-choice'+(index===selection?' active':'');
      const thumb=document.createElement('canvas');thumb.width=56;thumb.height=56;
      const t=thumb.getContext('2d');t.imageSmoothingEnabled=false;
      if(item.image)t.drawImage(item.image,4,4,48,48);else{t.fillStyle='#455';t.fillRect(4,4,48,48)}
      const label=document.createElement('span');label.textContent=item.label;
      button.append(thumb,label);button.title=item.file;
      button.addEventListener('click',()=>{selection=index;startedAt=performance.now();fileList.querySelectorAll('.file-choice').forEach((entry,i)=>entry.classList.toggle('active',i===selection));draw()});
      fileList.append(button);
    });
  }
  loopToggle.addEventListener('change',()=>{loop=loopToggle.checked;startedAt=performance.now();draw()});
  $('copySettings').addEventListener('click',async()=>{
    const result={enemy_key:enemyKey,move_speed_px_per_second:tuning.moveSpeed,animation_move_frame_seconds:enemyMoveImages.map((_,index)=>moveTime(index)),animation_attack_frame_seconds:enemyAttackImages.map((_,index)=>attackTime(index))};
    try{await navigator.clipboard.writeText(JSON.stringify(result,null,2));$('notice').textContent='設定値をコピーしました'}
    catch{$('notice').textContent=JSON.stringify(result)}
  });
  function selectedFrame(now){
    const files=filesForSelection();if(!files.length)return null;
    if(!loop||files.length===1)return files[Math.min(selection,files.length-1)];
    const elapsed=Math.max(0,(now-startedAt)/1000);
    if(category==='enemy'){
      if(action==='attack'){
        const durations=files.map((_,index)=>attackTime(index));let time=elapsed%durations.reduce((sum,value)=>sum+value,0);
        for(let index=0;index<files.length;index++){if(time<durations[index])return files[index];time-=durations[index]}
        return files.at(-1);
      }
      const durations=files.map((_,index)=>moveTime(index));let time=elapsed%durations.reduce((a,b)=>a+b,0);
      for(let i=0;i<files.length;i++){if(time<durations[i])return files[i];time-=durations[i]}
      return files[0];
    }
    const index=Math.floor(elapsed/.14)%files.length;
    return files[index];
  }
  function drawPlayer(item,x,y){
    if(item?.image)drawImage(item,x,y,item.image.naturalWidth||item.image.width,item.image.naturalHeight||item.image.height);
  }
  function drawImage(item,x,y,w,h){
    if(!item?.image)return;
    ctx.imageSmoothingEnabled=false;ctx.drawImage(item.image,x-w/2,y-h/2,w,h);ctx.imageSmoothingEnabled=true;
  }
  function drawEnemyImage(item,x,y,angle){ctx.save();ctx.translate(x,y);if(AttackRange.enemySpriteFlipped(angle,enemyMasterData[enemyKey]))ctx.scale(-1,1);drawImage(item,0,0,56,56);ctx.restore()}
  function drawRangePreview(cx,cy){
    const scale=48/32,target=rangeTarget||{x:cx+canvasWidth*.22,y:cy},settings=rangeSettings[rangeMode];
    if(rangeGrid){ctx.strokeStyle='rgba(222,239,220,.20)';ctx.lineWidth=1;const step=32*scale;for(let x=cx%step;x<canvasWidth;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvasHeight);ctx.stroke()}for(let y=cy%step;y<canvasHeight;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvasWidth,y);ctx.stroke()}}
    const limit=((rangeOwner==='enemy'?AttackRange.enemyRadius(enemyKey,enemyMasterData[enemyKey]):14)+Number(settings?.range_px||0)-(rangeOwner==='enemy'&&rangeMode==='contact'?3:0))*scale;
    if(settings){ctx.save();ctx.translate(cx,cy);ctx.fillStyle='rgba(241,198,99,.16)';ctx.strokeStyle='rgba(241,198,99,.8)';ctx.lineWidth=2;ctx.beginPath();if(settings.angle_degrees<360){const half=settings.angle_degrees*Math.PI/360;ctx.moveTo(0,0);ctx.arc(0,0,limit,rangePlayerAngle-half,rangePlayerAngle+half);ctx.closePath()}else ctx.arc(0,0,limit,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
    ctx.strokeStyle='rgba(242,245,222,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(target.x,target.y);ctx.stroke();
    const now=performance.now(),striking=now<rangeStrikeUntil,progress=striking?(now-rangeStrikeStartedAt)/rangeAttackDuration():0;
    let enemy=enemyMoveImages.find(item=>item.image)||enemyAttackImages.find(item=>item.image);
    if(rangeOwner==='enemy'&&striking&&enemyAttackImages.length){let time=(now-rangeStrikeStartedAt)/1000;enemy=enemyAttackImages.at(-1);for(let i=0;i<enemyAttackImages.length;i++){if(time<attackTime(i)){enemy=enemyAttackImages[i];break}time-=attackTime(i)}}
    const enemyX=rangeOwner==='enemy'?cx:target.x,enemyY=rangeOwner==='enemy'?cy:target.y,playerX=rangeOwner==='enemy'?target.x:cx,playerY=rangeOwner==='enemy'?target.y:cy;
    if(enemy){const angle=rangeOwner==='enemy'?rangePlayerAngle:Math.atan2(playerY-enemyY,playerX-enemyX);drawEnemyImage(enemy,enemyX,enemyY,angle)}else{ctx.fillStyle='#b88257';ctx.beginPath();ctx.arc(enemyX,enemyY,AttackRange.enemyRadius(enemyKey,enemyMasterData[enemyKey])*scale,0,Math.PI*2);ctx.fill()}
    drawPlayer(actorImages[4],playerX,playerY);
    if(striking&&rangeStrikeHit&&progress>.35){ctx.save();ctx.globalAlpha=Math.max(0,1-progress);ctx.strokeStyle='#fff5c6';ctx.lineWidth=5;ctx.beginPath();ctx.arc(target.x,target.y,22+progress*18,0,Math.PI*2);ctx.stroke();ctx.restore()}
    if(striking&&rangeOwner==='player'){
      const angle=rangeMode==='spin'?rangePlayerAngle+progress*Math.PI*2:rangePlayerAngle-1.1+progress*2.2;
      ctx.save();ctx.translate(cx,cy-5);ctx.rotate(angle+Math.PI/2);drawImage(swordImage,0,-48,38,38);ctx.restore();
      ctx.save();ctx.strokeStyle=rangeMode==='object'?'#9ae3dc':'#ffe09b';ctx.globalAlpha=1-progress;ctx.lineWidth=9;ctx.beginPath();ctx.arc(cx,cy,55,angle-.7,angle+.7);ctx.stroke();ctx.restore();
    }else{ctx.strokeStyle='#f4f1dc';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(rangePlayerAngle)*40,cy+Math.sin(rangePlayerAngle)*40);ctx.stroke()}
    const hit=rangeTargetIsHit();ctx.fillStyle=striking?(rangeStrikeHit?'#a7f4b7':'#ff927f'):hit?'#a7f4b7':'#ffe09b';ctx.font='700 13px system-ui';ctx.textAlign='center';ctx.fillText(!settings?'設定なし':striking?(rangeStrikeHit?'命中':'空振り'):hit?'命中範囲内':'範囲外',target.x,target.y-42);
  }
  function draw(){
    if(!canvasWidth||!canvasHeight||!canvas.classList.contains('active'))return;
    const now=performance.now(),cx=canvasWidth/2,cy=canvasHeight/2;
    ctx.clearRect(0,0,canvasWidth,canvasHeight);ctx.fillStyle='#000';ctx.fillRect(0,0,canvasWidth,canvasHeight);
    if(category==='attackRange'&&action==='player'){
      drawRangePreview(cx,cy);
    }else if(category==='player'){
      const frame=selectedFrame(now),player=actorImages[Math.min(selection,7)];
      if(action==='move')drawPlayer(frame||player,cx,cy);
      else if(action==='attack'){
        const elapsed=(now-startedAt)/650,phase=loop?elapsed%1:Math.min(elapsed,1),angle=-Math.PI/2+phase*Math.PI*2;
        const chosen=frame||player;
        drawPlayer(actorImages[4]||player,cx,cy);
        if(loop||elapsed<1){
          ctx.save();ctx.translate(cx,cy-5);ctx.rotate(angle+Math.PI/2);drawImage(swordImage,0,-48,38,38);ctx.restore();
          ctx.beginPath();ctx.arc(cx,cy,55,angle-1.05,angle+1.05);ctx.strokeStyle='rgba(255,220,147,'+(0.25+0.65*(1-phase))+')';ctx.lineWidth=9;ctx.stroke();
        }
        if(!loop&&chosen?.image)drawImage(chosen,cx+90,cy,40,40);
      }
    }else if(category==='enemy'){
      const playerImage=actorImages[4],files=filesForSelection(),enemy=selectedFrame(now)||files[0],time=(now-startedAt)/1000;
      if(!files.length){ctx.fillStyle='#c2d0c6';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText(`${enemyKey}の${action==='attack'?'攻撃':'移動'}画像は未配置です`,cx,cy);return}
      drawPlayer(playerImage,cx,cy);
      if(action==='move'){
        const startX=Math.min(canvasWidth-50,cx+Math.min(200,canvasWidth*.38)),endX=cx+45,distance=Math.max(1,startX-endX);
        const travel=tuning.moveSpeed>0?distance/tuning.moveSpeed:Infinity;
        const x=tuning.moveSpeed===0?startX:startX-(time%travel)*tuning.moveSpeed;
        drawEnemyImage(enemy,x,cy,Math.PI);
      }else if(action==='attack'){
        drawEnemyImage(enemy,cx+40,cy,Math.PI);
      }
    }
  }
  function animate(now){
    if(action&&canvas.classList.contains('active'))draw();
  requestAnimationFrame(animate);
  }
  menuButtons.forEach(button=>button.addEventListener('click',()=>showCategory(button.dataset.category)));
  requestAnimationFrame(animate);
})();


