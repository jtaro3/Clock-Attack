(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const home=$('home'),previewScreen=$('previewScreen'),gameFrame=$('gameFrame'),canvas=$('assetCanvas'),ctx=canvas.getContext('2d');
  const hint=$('hint'),panel=$('debugPanel'),subChoices=$('subChoices'),fileList=$('fileList'),loopToggle=$('loopToggle'),tuningPanel=$('tuning');
  const inputs={moveSpeed:$('moveSpeed'),idleTime:$('idleTime'),midTime:$('midTime'),peakTime:$('peakTime')};
  const outputs={moveSpeed:$('moveSpeedValue'),idleTime:$('idleTimeValue'),midTime:$('midTimeValue'),peakTime:$('peakTimeValue')};
  const STORAGE_KEY='clock-attack-blue-slime-tuning-v1';
  const defaults={moveSpeed:27,idleTime:.38,midTime:.12,peakTime:.12};
  let tuningEdited=false;
  let tuning=readTuning(),category='',action='',selection=0,loop=false,startedAt=performance.now(),canvasWidth=0,canvasHeight=0,dpr=1,actorImages=[],swordImage=null;
  const playerBounds=[[386,362,850,928],[396,376,846,930],[432,356,812,956],[396,344,836,952],[386,350,866,946],[374,340,862,916],[394,344,828,926],[396,324,828,922]];
  const playerNames=['man1.png','man2.png','man3.png','man4.png','man5.png','man6.png','man7.png','man8.png'];
  let enemyMoveImages=[],enemyAttackImages=[];
  const attackSettings=$('attackSettings');
  const attackFrameDefault=.105;
  const enemySequence=[0,1,2,1,0];
  const enemyDurations=()=>[tuning.idleTime,tuning.midTime,tuning.peakTime,tuning.midTime,tuning.idleTime];
  const menuButtons=[...document.querySelectorAll('[data-category]')];
  function readTuning(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return {...defaults,...saved,attackTimes:Array.isArray(saved.attackTimes)?saved.attackTimes:[]};
    }catch{return {...defaults,attackTimes:[]}}
  }
  function attackTime(index){
    const value=Number(tuning.attackTimes[index]);
    return Number.isFinite(value)&&value>0?Math.max(.04,Math.min(.5,value)):attackFrameDefault;
  }
  function buildAttackSettings(){
    attackSettings.replaceChildren();
    enemyAttackImages.forEach((frame,index)=>{
      const row=document.createElement('div'),label=document.createElement('label'),output=document.createElement('output'),input=document.createElement('input');
      row.className='slider-row';label.htmlFor=`attackTime${index}`;label.textContent=`${frame.file} 表示時間`;
      input.id=label.htmlFor;input.type='range';input.min='.04';input.max='.50';input.step='.01';input.value=String(attackTime(index));
      output.textContent=`${Number(input.value).toFixed(2)} s`;
      input.addEventListener('input',()=>{
        tuning.attackTimes[index]=Number(input.value);output.textContent=`${Number(input.value).toFixed(2)} s`;
        tuningEdited=true;localStorage.setItem(STORAGE_KEY,JSON.stringify(tuning));startedAt=performance.now();draw();
      });
      row.append(label,output,input);attackSettings.append(row);
    });
  }
  for(const key of Object.keys(inputs))inputs[key].value=String(tuning[key]);
  function saveTuning(){
    tuningEdited=true;
    for(const key of Object.keys(inputs))tuning[key]=Number(inputs[key].value);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(tuning));
    updateOutputs();draw();
  }
  function updateOutputs(){
    for(const key of Object.keys(inputs))outputs[key].textContent=key==='moveSpeed'?tuning[key]+' px/s':tuning[key].toFixed(2)+' s';
  }
  for(const key of Object.keys(inputs))inputs[key].addEventListener('input',saveTuning);
  updateOutputs();
  if(!localStorage.getItem(STORAGE_KEY)){
    fetch('game-data.json',{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error('HTTP '+response.status);
      return response.json();
    }).then(data=>{
      if(tuningEdited)return;
      const enemy=data.enemies?.slime_blue||{};
      const values={moveSpeed:enemy.move_speed_px_per_second,idleTime:enemy.animation_idle_seconds,midTime:enemy.animation_jump_mid_seconds,peakTime:enemy.animation_jump_peak_seconds};
      for(const key of Object.keys(inputs))if(values[key]!=null&&Number.isFinite(Number(values[key]))){
        inputs[key].value=String(values[key]);tuning[key]=Number(inputs[key].value);
      }
      updateOutputs();draw();
    }).catch(()=>{$('notice').textContent='ゲームデータを読み込めないため初期値を表示しています'});
  }
  $('loadDataSettings').addEventListener('click',async()=>{
    try{
      const response=await fetch('game-data.json',{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json(),enemy=data.enemies?.slime_blue||{};
      const values={moveSpeed:enemy.move_speed_px_per_second,idleTime:enemy.animation_idle_seconds,midTime:enemy.animation_jump_mid_seconds,peakTime:enemy.animation_jump_peak_seconds};
      for(const key of Object.keys(inputs))if(Number.isFinite(Number(values[key])))inputs[key].value=String(values[key]);
      tuning.attackTimes=[];buildAttackSettings();saveTuning();$('notice').textContent='ゲームデータの青スライム設定を読み込みました';
    }catch{$('notice').textContent='game-data.jsonを読み込めませんでした'}
  });
  function loadSprite(file,index){
    return new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{
        const [left,top,right,bottom]=playerBounds[index],margin=16;
        const sw=right-left+margin*2+1,sh=bottom-top+margin*2+1;
        const crop=document.createElement('canvas');crop.width=sw;crop.height=sh;
        const c=crop.getContext('2d',{willReadFrequently:true});
        c.drawImage(image,left-margin,top-margin,sw,sh,0,0,sw,sh);
        const pixels=c.getImageData(0,0,sw,sh);
        for(let p=0;p<pixels.data.length;p+=4)if(Math.max(pixels.data[p],pixels.data[p+1],pixels.data[p+2])<=2)pixels.data[p+3]=0;
        c.putImageData(pixels,0,0);resolve({file,label:file,image:crop});
      };
      image.onerror=()=>resolve({file,label:file,image:null});
      image.src='design/'+file;
    });
  }
  function loadImage(file,label){
    return new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>resolve({file,label,image});
      image.onerror=()=>resolve({file,label,image:null});
      image.src=file==='sword.svg'?'design/sword.svg':label;
    });
  }
  const fallbackMove=['design/enemies/slime_blue_idle.png','design/enemies/slime_blue_jump_mid.png','design/enemies/slime_blue_jump_peak.png'];
  const fallbackAttack=['design/enemies/slime-blue-attack-01.png','design/enemies/slime-blue-attack-02.png','design/enemies/slime-blue-attack-03.png','design/enemies/slime-blue-attack-04.png'];
  fetch('animation-manifest.json',{cache:'no-store'}).then(response=>response.ok?response.json():{}).catch(()=>({})).then(manifest=>{
    const moves=manifest.enemies?.slime_blue?.move?.length?manifest.enemies.slime_blue.move:fallbackMove;
    const attacks=manifest.enemies?.slime_blue?.attack?.length?manifest.enemies.slime_blue.attack:fallbackAttack;
    return Promise.all([
      ...playerNames.map((name,i)=>loadSprite(name,i)),
      ...moves.map(path=>loadImage(path.split('/').pop(),path)),
      loadImage('sword.svg','sword.svg'),
      ...attacks.map(path=>loadImage(path.split('/').pop(),path))
    ]).then(items=>({items,moveCount:moves.length,attackCount:attacks.length}));
  }).then(({items,moveCount,attackCount})=>{actorImages=items.slice(0,8);enemyMoveImages=items.slice(8,8+moveCount);swordImage=items[8+moveCount];enemyAttackImages=items.slice(9+moveCount,9+moveCount+attackCount);buildAttackSettings();buildFileList();draw()});
  function setCanvasSize(){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    dpr=Math.max(1,Math.min(2,devicePixelRatio||1));canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    canvasWidth=rect.width;canvasHeight=rect.height;ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  }
  new ResizeObserver(setCanvasSize).observe(canvas);
  function showCategory(next){
    category=next;action='';selection=0;startedAt=performance.now();
    menuButtons.forEach(button=>button.classList.toggle('active',button.dataset.category===next));
    home.classList.remove('active');previewScreen.classList.add('active');panel.hidden=false;
    gameFrame.classList.remove('active');canvas.classList.remove('active');hint.hidden=false;
    hint.textContent='上部の項目から演出を選択';
    subChoices.replaceChildren();fileList.replaceChildren();fileList.hidden=true;loopToggle.closest('.loop-row').hidden=true;tuningPanel.hidden=true;
    if(next==='hourglass'){
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
    tuningPanel.hidden=category!=='enemy';
    document.querySelectorAll('.move-setting').forEach(row=>row.hidden=next==='attack');
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
    const result={enemy_key:'slime_blue',move_speed_px_per_second:tuning.moveSpeed,animation_idle_seconds:tuning.idleTime,animation_jump_mid_seconds:tuning.midTime,animation_jump_peak_seconds:tuning.peakTime,animation_attack_frame_seconds:enemyAttackImages.map((_,index)=>attackTime(index))};
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
      const seq=files.map((_,index)=>index),durations=files.map((_,index)=>index===0?tuning.idleTime:tuning.midTime);let time=elapsed%durations.reduce((a,b)=>a+b,0);
      for(let i=0;i<seq.length;i++){if(time<durations[i])return files[seq[i]];time-=durations[i]}
      return files[0];
    }
    const index=Math.floor(elapsed/.14)%files.length;
    return files[index];
  }
  function drawImage(item,x,y,w,h){
    if(!item?.image)return;
    ctx.imageSmoothingEnabled=false;ctx.drawImage(item.image,x-w/2,y-h/2,w,h);ctx.imageSmoothingEnabled=true;
  }
  function draw(){
    if(!canvasWidth||!canvasHeight||!canvas.classList.contains('active'))return;
    const now=performance.now(),cx=canvasWidth/2,cy=canvasHeight/2;
    ctx.clearRect(0,0,canvasWidth,canvasHeight);ctx.fillStyle='#000';ctx.fillRect(0,0,canvasWidth,canvasHeight);
    if(category==='player'){
      const frame=selectedFrame(now),player=actorImages[Math.min(selection,7)];
      if(action==='move')drawImage(frame||player,cx,cy,64,64);
      else if(action==='attack'){
        const elapsed=(now-startedAt)/650,phase=loop?elapsed%1:Math.min(elapsed,1),angle=-Math.PI/2+phase*Math.PI*2;
        const chosen=frame||player;
        drawImage(actorImages[4]||player,cx,cy,64,64);
        if(loop||elapsed<1){
          ctx.save();ctx.translate(cx,cy-5);ctx.rotate(angle+Math.PI/2);drawImage(swordImage,0,-48,38,38);ctx.restore();
          ctx.beginPath();ctx.arc(cx,cy,55,angle-1.05,angle+1.05);ctx.strokeStyle='rgba(255,220,147,'+(0.25+0.65*(1-phase))+')';ctx.lineWidth=9;ctx.stroke();
        }
        if(!loop&&chosen?.image)drawImage(chosen,cx+90,cy,40,40);
      }
    }else if(category==='enemy'){
      const playerImage=actorImages[4],files=filesForSelection(),enemy=selectedFrame(now)||files[0],time=(now-startedAt)/1000;
      drawImage(playerImage,cx,cy,64,64);
      if(action==='move'){
        const startX=Math.min(canvasWidth-50,cx+Math.min(200,canvasWidth*.38)),endX=cx+45,distance=Math.max(1,startX-endX);
        const travel=tuning.moveSpeed>0?distance/tuning.moveSpeed:Infinity;
        const x=tuning.moveSpeed===0?startX:startX-(time%travel)*tuning.moveSpeed;
        drawImage(enemy,x,cy,56,56);
      }else if(action==='attack'){
        ctx.save();ctx.translate(cx+40,cy);ctx.scale(-1,1);drawImage(enemy,0,0,56,56);ctx.restore();
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


