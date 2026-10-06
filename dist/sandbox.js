(async()=>{
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d'),keys=new Set(),W=640,H=480;
  let data,manifest,ai={},running=false,last=performance.now(),time=0,target=null,drag=null,press=null,loadId=0,enemyImages={move:[],attack:[]},playerImages=[],selected='',playerAttackUntil=0,enemyAttackUntil=0,playerInvincible=0,notice='配置を調整してスタートしてください';
  let p={x:220,y:240,r:14,angle:0},e={x:420,y:240,r:14,angle:Math.PI};
  let values={},bases={},playerAttackRange=null,enemyAttackRange=null;
  const clip=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  async function json(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path+'を読み込めません');return r.json()}
  function loadImage(path){return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=path})}
  function sliders(){
    for(const [owner,rows] of Object.entries({player:[['php','HP',0,500],['patk','攻撃力',1,30],['pspeed','移動速度 %',50,200]],enemy:[['ehp','HP',1,100],['eatk','攻撃力',1,100],['espeed','移動速度 %',50,200]]})){
      $(owner+'Sliders').replaceChildren();
      for(const [key,label,min,max] of rows){const row=document.createElement('label');row.className='slider';const name=document.createElement('span');name.textContent=label;const out=document.createElement('output');out.textContent=values[key];const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=1;input.value=values[key];input.id=key;input.addEventListener('input',()=>{values[key]=Number(input.value);out.textContent=input.value;running=false;$('start').textContent='スタート';p.hp=values.php;e.hp=values.ehp;target=null;notice='設定を変更しました。スタートで再開できます'});row.append(name,out,input);$(owner+'Sliders').append(row)}
    }
  }
  function resetPositions(){running=false;p={x:220,y:240,r:14,angle:0,hp:values.php};e={x:420,y:240,r:AttackRange.enemyRadius(selected,data.enemies[selected]),angle:Math.PI,hp:values.ehp,aiType:$('aiSelect').value,state:'wait',waitRemaining:0};time=0;target=null;playerInvincible=0;playerAttackUntil=enemyAttackUntil=0;$('start').textContent='スタート';notice='配置を調整してスタートしてください'}
  function aiInfo(){const c=ai[$('aiSelect').value],ranges=data.attack_range?.enemy?.[selected]||{};$('aiInfo').textContent=c?`発見 ${c.ai_detection_range_px}px ／ 停止 ${c.ai_stop_distance_px}px ／ 追跡終了 ${c.ai_lose_target_range_px}px ／ 待機 ${c.ai_wait_seconds}秒 ／ 攻撃準備 ${c.ai_attack_preparation_seconds||0}秒 ／ 攻撃後 ${c.ai_attack_recovery_seconds||0}秒`+(ranges.normal?'':' ／ 通常攻撃範囲未設定（追加距離0px・360度）'):$('aiSelect').value==='chase'?'プレイヤーを直接追跡します':'AIシートの設定がありません';enemyAttackRange=(c?ranges.normal:ranges.contact)||{range_px:0,angle_degrees:360};e.aiType=$('aiSelect').value;e.state='wait';e.waitRemaining=0;e.combatPhase=null;e.attackTime=0;enemyAttackUntil=0}
  async function selectEnemy(){
    const id=++loadId;selected=$('enemySelect').value;const m=data.enemies[selected];bases={pspeed:num(data.general.movement_speed,124),espeed:num(m.move_speed_px_per_second,27)};
    values={php:clip(num(data.general.start_energy,100),0,500),patk:clip(num(data.player.base_attack_damage,1),1,30),pspeed:100,ehp:clip(num(m.hp,1),1,100),eatk:clip(num(m.attack,1),1,100),espeed:100};
    playerAttackRange=data.attack_range?.player?.player?.normal||{range_px:42,angle_degrees:182};const r=data.attack_range?.enemy?.[selected]||{};enemyAttackRange=r.normal||r.contact||Object.values(r)[0]||{range_px:0,angle_degrees:360};
    $('aiSelect').value=m.ai_type==='chase2'?'chase2':'chase';sliders();resetPositions();aiInfo();enemyImages={move:[],attack:[]};
    const frames=manifest.enemies?.[selected]||{};const move=await Promise.all((frames.move||[]).map(loadImage)),attack=await Promise.all((frames.attack||[]).map(loadImage));if(id!==loadId)return;enemyImages={move,attack};
  }
  function bound(body){body.x=clip(body.x,body.r,W-body.r);body.y=clip(body.y,body.r,H-body.r)}
  function attack(){if(!running||time<playerAttackUntil||p.hp<=0)return;playerAttackUntil=time+.27;if(AttackRange.contains(p,e,playerAttackRange)){e.hp=Math.max(0,e.hp-values.patk);e.flashUntil=time+.18;const m=data.enemies[selected],config=ai[e.aiType],reaction=SandboxAI.reactions(config,m.super_armor,e.combatPhase==='prepare'||e.combatPhase==='attack');if(reaction.flinch&&config){SandboxAI.cancelAttack(e,config);enemyAttackUntil=0}if(reaction.knockback){const a=Math.atan2(e.y-p.y,e.x-p.x),n=num(m.knockback_distance_px,18.75);e.x+=Math.cos(a)*n;e.y+=Math.sin(a)*n;bound(e)}notice='プレイヤーの攻撃が命中'}else notice='プレイヤーの攻撃は範囲外'}
  function step(dt){
    if(!running)return;time+=dt;playerInvincible=Math.max(0,playerInvincible-dt);
    let dx=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),dy=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);
    let distance=Math.hypot(dx,dy);if(!distance&&target){dx=target.x-p.x;dy=target.y-p.y;distance=Math.hypot(dx,dy);if(distance<2){target=null;distance=0}}
    if(distance){const speed=bases.pspeed*values.pspeed/100,amount=Math.min(speed*dt,target&&!keys.size?distance:Infinity);p.x+=dx/distance*amount;p.y+=dy/distance*amount;p.angle=Math.atan2(dy,dx);bound(p)}
    e.speed=bases.espeed*values.espeed/100;const config=ai[e.aiType];let hit;
    if(config){const ranges=data.attack_range?.enemy?.[selected]||{};hit=SandboxAI.stepCombat(e,p,dt,config,{duration:attackDuration(),normal:ranges.normal||{range_px:0,angle_degrees:360},contact:ranges.contact||{range_px:0,angle_degrees:360},contains:AttackRange.contains,move:(body,x,y)=>{body.x+=x;body.y+=y;bound(body)}});enemyAttackUntil=time+(e.attackTime||0)}
    else{if(time>=enemyAttackUntil)SandboxAI.stepAI(e,p,dt);hit=AttackRange.contains(e,p,data.attack_range?.enemy?.[selected]?.contact||{range_px:0,angle_degrees:360},true)}bound(e);
    if(hit&&playerInvincible<=0){p.hp=Math.max(0,p.hp-values.eatk);playerInvincible=num(data.general.hit_Invincibility_Duration,1.15);if(!config){enemyAttackUntil=time+attackDuration();e.angle=Math.atan2(p.y-e.y,p.x-e.x)}const a=Math.atan2(p.y-e.y,p.x-e.x),n=num(data.player.damage_knockback_distance_px,20);p.x+=Math.cos(a)*n;p.y+=Math.sin(a)*n;bound(p);notice='エネミーの攻撃が命中'}
    if(p.hp<=0||e.hp<=0){running=false;$('start').textContent='もう一度';notice=p.hp<=0?'プレイヤーが倒れました':'エネミーを倒しました'}
  }
  function attackDuration(){const times=data.enemies[selected]?.animation_attack_frame_seconds;return times?.length?times.reduce((s,v)=>s+Number(v),0):.42}
  function frame(action){const images=enemyImages[action];if(!images.length)return enemyImages.attack[0]||null;const times=data.enemies[selected]?.['animation_'+action+'_frame_seconds']||images.map(()=>action==='attack'?.105:.14),total=times.reduce((s,v)=>s+Number(v),0)||1;let t=action==='attack'?Math.max(0,attackDuration()-(enemyAttackUntil-time)):time%total;for(let i=0;i<images.length;i++){if(t<Number(times[i]||.14))return images[i];t-=Number(times[i]||.14)}return images.at(-1)}
  function range(body,target,setting,color){ctx.save();ctx.translate(body.x,body.y);ctx.fillStyle=color+'25';ctx.strokeStyle=color;ctx.lineWidth=2;const radius=body.r+Number(setting.range_px),half=Number(setting.angle_degrees)*Math.PI/360;ctx.beginPath();if(half>=Math.PI)ctx.arc(0,0,radius,0,Math.PI*2);else{ctx.moveTo(0,0);ctx.arc(0,0,radius,body.angle-half,body.angle+half);ctx.closePath()}ctx.fill();ctx.stroke();ctx.restore()}
  function draw(){
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);if($('grid').checked){ctx.strokeStyle='#ffffff24';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=W;x+=32){ctx.moveTo(x,0);ctx.lineTo(x,H)}for(let y=0;y<=H;y+=32){ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke()}
    if(playerAttackRange&&$('playerRange').checked)range(p,e,playerAttackRange,'#67d9ff');if(enemyAttackRange&&$('enemyRange').checked)range(e,p,enemyAttackRange,'#ff8696');
    const facing=(Math.round((p.angle+Math.PI/2)/(Math.PI/4))+8)%8,pi=playerImages[facing];if(pi)ctx.drawImage(pi,p.x-pi.naturalWidth/2,p.y-pi.naturalHeight/2);else{ctx.fillStyle='#67d9ff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill()}
    const image=frame(time<enemyAttackUntil?'attack':'move');if(image){ctx.save();ctx.translate(e.x,e.y);if(AttackRange.enemySpriteFlipped(e.angle,data.enemies[selected]))ctx.scale(-1,1);const size=AttackRange.enemySpriteSize(data.enemies[selected]);ctx.drawImage(image,-size/2,-size/2,size,size);ctx.restore()}else{ctx.fillStyle=({slime_blue:'#66c8ee',slime_green:'#74d590',slime_red:'#e97a83',slime_purple:'#b679e5',slime_black:'#444',slime_metal:'#bec8d1'})[selected]||'#7ac9e8';ctx.beginPath();ctx.arc(e.x,e.y,AttackRange.enemySpriteSize(data.enemies[selected])/2,0,7);ctx.fill()}
    if(time<playerAttackUntil){ctx.strokeStyle='#ffe297';ctx.lineWidth=6;ctx.beginPath();ctx.arc(p.x,p.y,45,p.angle-.95,p.angle+.95);ctx.stroke()}
    for(const [b,color,label] of [[p,'#67d9ff','プレイヤー'],[e,'#ff8696','エネミー']]){ctx.fillStyle=color;ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(label,b.x,b.y-(b===e?AttackRange.enemySpriteSize(data.enemies[selected])/2+12:40));ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x+Math.cos(b.angle)*20,b.y+Math.sin(b.angle)*20);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke()}
    $('playerHp').textContent='プレイヤー HP '+Math.ceil(p.hp||0)+' / '+values.php;$('enemyHp').textContent='エネミー HP '+Math.ceil(e.hp||0)+' / '+values.ehp;$('status').textContent=notice+(running?' ／ AI: '+e.aiType+'・'+e.state:'');$('attack').disabled=!running;
  }
  function point(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*W/r.width,y:(event.clientY-r.top)*H/r.height}}
  canvas.addEventListener('pointerdown',event=>{const pos=point(event);canvas.setPointerCapture(event.pointerId);press={pos,id:event.pointerId};if(!running){const actor=Math.hypot(pos.x-p.x,pos.y-p.y)<36?p:Math.hypot(pos.x-e.x,pos.y-e.y)<36?e:null;if(actor)press.timer=setTimeout(()=>{drag=actor;notice='ドラッグして配置を調整できます'},350)}else target=pos});
  canvas.addEventListener('pointermove',event=>{if(!press||press.id!==event.pointerId)return;const pos=point(event);if(drag){drag.x=pos.x;drag.y=pos.y;bound(drag)}else if(running)target=pos;else if(Math.hypot(pos.x-press.pos.x,pos.y-press.pos.y)>12)clearTimeout(press.timer)});
  function release(){if(press)clearTimeout(press.timer);press=null;drag=null}canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  window.addEventListener('keydown',event=>{if(/INPUT|SELECT/.test(event.target.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'].includes(event.code)){event.preventDefault();if(event.code==='Space')attack();else{keys.add(event.code);target=null}}});window.addEventListener('keyup',event=>keys.delete(event.code));window.addEventListener('blur',()=>{keys.clear();target=null;running=false;$('start').textContent='スタート'});
  $('start').addEventListener('click',()=>{if(p.hp<=0||e.hp<=0)resetPositions();running=!running;$('start').textContent=running?'停止':'スタート';notice=running?'対戦中':'停止中。長押しで配置を調整できます'});$('attack').addEventListener('click',attack);$('reset').addEventListener('click',resetPositions);$('enemySelect').addEventListener('change',selectEnemy);$('aiSelect').addEventListener('change',()=>{running=false;$('start').textContent='スタート';aiInfo()});$('masterReset').addEventListener('click',selectEnemy);
  try{
    [data,manifest]=await Promise.all([json('game-data.json'),json('animation-manifest.json')]);ai=data.ai||{};
    const version=await fetch('VERSION',{cache:'no-store'});$('version').textContent='v'+(await version.text()).trim();
    for(const [key,enemy] of Object.entries(data.enemies)){const option=document.createElement('option');option.value=key;option.textContent=enemy.description+' ('+key+')';$('enemySelect').append(option)}
    if(!$('enemySelect').options.length)throw Error('有効なエネミーがありません');await selectEnemy();for(const id of ['start','reset','masterReset'])$(id).disabled=false;
    playerImages=await Promise.all(ClockAttackAssets.create(data.assets||[]).playerFiles().map(path=>path?loadImage(path+'?player=1.32'):null));
  }catch(error){notice=error.message}
  function animate(now){step(Math.min(.05,(now-last)/1000));last=now;draw();requestAnimationFrame(animate)}requestAnimationFrame(animate);
})();
