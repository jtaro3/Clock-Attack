(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const canvas=$('field'),ctx=canvas.getContext('2d');
  const ui={overlay:$('overlay'),panel:$('panel'),title:$('title'),eyebrow:$('eyebrow'),description:$('description'),readout:$('readout'),hourHand:$('hourHand'),minuteHand:$('minuteHand'),previewAttack:$('previewAttack'),previewMove:$('previewMove'),stop:$('stop'),sub:$('sub'),score:$('score'),health:$('health'),attackCount:$('attackCount'),clockCount:$('clockCount'),clockButton:$('clockButton'),clockStock:$('clockStock'),attack:$('attack')};
  const player={x:0,y:0,r:14,angle:-Math.PI/2};
  const enemies=[],particles=[],clocks=[],storedClocks=[];
  const clockTypes={blue:{label:'青い時計',color:'#66c8ee',effect:'移動距離が10倍'},green:{label:'緑の時計',color:'#74d590',effect:'攻撃回数が5倍'},red:{label:'赤い時計',color:'#e97a83',effect:'HP全回復・5秒無敵'}};
  const drag={pointer:null,x:0,y:0};
  const charge={pointer:null,start:0,timer:null};
  const keys=new Set();
  let w=0,h=0,dpr=1,last=performance.now(),clockOrigin=last-61/1440*3000;
  let mode='select',selectionReason='start',selectedClockType=null,transitionTimer=null;
  let attacks=0,distance=0,health=3,score=0,spawnTimer=0,invincible=0,swing=0,spin=0,swingAngle=0,shake=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const minY=()=>Math.max(92,h*.12),maxY=()=>Math.max(minY()+60,h-130);

  function resize(){
    const oldW=w,oldH=h,app=$('app');
    w=app.clientWidth;h=app.clientHeight;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!oldW){player.x=w/2;player.y=(minY()+maxY())/2}
    else{player.x=clamp(player.x*w/oldW,18,w-18);player.y=clamp(player.y*h/oldH,minY()+18,maxY()-18)}
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
  for(let n=1;n<=12;n++){
    const label=document.createElement('span'),angle=n*Math.PI/6,r=face.offsetWidth*.35;
    label.className='numeral';label.textContent=n;
    label.style.left=`calc(50% + ${Math.sin(angle)*r}px)`;
    label.style.top=`calc(50% - ${Math.cos(angle)*r}px)`;
    face.insertBefore(label,ui.hourHand);
  }
  const stockSlots=[];
  for(let i=0;i<10;i++){
    const slot=document.createElement('span');slot.className='stock-slot';
    slot.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M16 9v7l5 3"/></svg>';
    ui.clockStock.appendChild(slot);stockSlots.push(slot);
  }

  function timeValues(now){
    const phase=((now-clockOrigin)%3000+3000)%3000/3000;
    const total=Math.floor(phase*1440),hour24=Math.floor(total/60),minute=total%60;
    return {minute,attack:hour24%12||12,text:String(hour24).padStart(2,'0')+':'+String(minute).padStart(2,'0'),phase};
  }
  function updateClock(now){
    const t=timeValues(now);
    ui.readout.textContent=t.text;
    ui.hourHand.style.transform=`rotate(${t.phase*720}deg)`;
    ui.minuteHand.style.transform=`rotate(${t.minute*6}deg)`;
    return t;
  }
  function setHud(){
    ui.score.textContent=score;
    ui.health.textContent=`${health}/10`;
    ui.attackCount.textContent=attacks;
    ui.clockCount.textContent=storedClocks.length;
    ui.clockButton.disabled=mode!=='play'||storedClocks.length===0;
    ui.clockButton.dataset.clock=storedClocks[0]||'';
    ui.clockButton.classList.toggle('ready',mode==='play'&&storedClocks.length>0);
    ui.attack.disabled=mode!=='play'||attacks<=0;
    for(let i=0;i<stockSlots.length;i++){
      const type=storedClocks[i]||'';
      stockSlots[i].dataset.clock=type;
      stockSlots[i].classList.toggle('filled',!!type);
      stockSlots[i].title=type?`${i+1}: ${clockTypes[type].label}`:'';
    }
  }
  function cancelCharge(){
    clearTimeout(charge.timer);charge.pointer=null;charge.timer=null;
    ui.attack.classList.remove('charging');ui.attack.style.setProperty('--charge','0%');
  }
  function startSelection(initial=false,bonus=false,type=null){
    clearTimeout(transitionTimer);transitionTimer=null;cancelCharge();
    mode='select';selectionReason=initial?'start':bonus?'bonus':'refill';selectedClockType=bonus?type:null;drag.pointer=null;
    clockOrigin=performance.now()-(initial?61/1440*3000:0);
    ui.overlay.classList.remove('hidden');
    ui.panel.classList.remove('gameover','paused','confirmed','bonus');ui.panel.classList.add('selecting');
    if(bonus){ui.panel.classList.add('bonus');ui.panel.style.setProperty('--bonus-color',clockTypes[type].color)}
    ui.eyebrow.textContent=bonus?clockTypes[type].label:initial?'3秒で一周する時計':'戦闘を再開する時刻';
    ui.title.textContent=bonus?'追加の時刻を決めよう':initial?'時を止めて、戦え。':'次の時刻を決めよう';
    ui.description.innerHTML=bonus?`${clockTypes[type].effect}。<br>確定した行動力を現在の値に加算します。`:initial?'短針は剣を振る回数、長針は移動できる距離。<br>好きな瞬間に時計を止めて、行動量を決めよう。':'時計を止めると、剣と移動距離が補充されます。';
    ui.stop.disabled=false;ui.stop.textContent='時計を止める';
    ui.sub.textContent='時計は止めるまで3秒ごとに回り続けます';setHud();
  }
  function stopClock(){
    if(mode==='gameover'){restart();return}
    if(mode!=='select')return;
    const t=updateClock(performance.now()),bonus=selectionReason==='bonus';
    const gainedAttacks=bonus&&selectedClockType==='green'?t.attack*5:t.attack;
    const gainedDistance=bonus&&selectedClockType==='blue'?t.minute*10:t.minute;
    attacks=bonus?attacks+gainedAttacks:gainedAttacks;
    distance=bonus?distance+gainedDistance:gainedDistance;
    health=Math.min(10,health+1);
    if(bonus&&selectedClockType==='red'){health=10;invincible=5}
    mode='confirmed';ui.panel.classList.remove('selecting');ui.panel.classList.add('confirmed');
    ui.previewAttack.textContent=(bonus?'+':'')+gainedAttacks;
    ui.previewMove.textContent=(bonus?'+':'')+gainedDistance;
    ui.eyebrow.textContent=`${t.text} で確定`;
    ui.title.textContent=bonus?clockTypes[selectedClockType].effect:'行動量が決まりました';
    ui.description.textContent=bonus?`剣 ${attacks} 回・移動 ${Math.ceil(distance)}・HP ${health}/10`:`HP ${health}/10。1秒後に戦闘を再開します`;
    ui.stop.disabled=true;ui.stop.textContent='まもなく開始';ui.sub.textContent='';setHud();
    transitionTimer=setTimeout(()=>{
      if(mode!=='confirmed')return;
      mode='play';ui.overlay.classList.add('hidden');spawnTimer=0;transitionTimer=null;setHud();
    },1000);
  }
  ui.stop.addEventListener('click',stopClock);
  function restart(){
    clearTimeout(transitionTimer);health=3;score=0;attacks=0;distance=0;
    enemies.length=0;particles.length=0;clocks.length=0;storedClocks.length=0;
    player.x=w/2;player.y=(minY()+maxY())/2;invincible=0;swing=0;spin=0;
    startSelection(true);
  }
  function gameOver(){
    clearTimeout(transitionTimer);cancelCharge();mode='gameover';drag.pointer=null;
    ui.overlay.classList.remove('hidden');ui.panel.classList.remove('selecting','paused','confirmed','bonus');ui.panel.classList.add('gameover');
    ui.eyebrow.textContent='GAME OVER';ui.title.textContent=`討伐 ${score} 体`;
    ui.description.textContent='時計を止めるタイミングを変えて、もう一度挑戦しよう。';
    ui.stop.disabled=false;ui.stop.textContent='もう一度遊ぶ';ui.sub.textContent='';setHud();
  }
  function checkExhausted(){
    if(mode!=='play'||attacks>0||distance>=.999||swing>0||spin>0)return;
    cancelCharge();
    mode='exhausted';drag.pointer=null;ui.overlay.classList.remove('hidden');
    ui.panel.classList.remove('selecting','confirmed','gameover');ui.panel.classList.add('paused');
    ui.eyebrow.textContent='戦闘を一時停止';ui.title.textContent='行動量を使い切りました';
    ui.description.textContent='時計を準備しています';ui.sub.textContent='';setHud();
    transitionTimer=setTimeout(()=>{if(mode==='exhausted')startSelection(false)},650);
  }
  function burst(x,y,color,count){
    for(let i=0;i<count;i++){
      const angle=Math.random()*Math.PI*2,speed=35+Math.random()*90;
      particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.25+Math.random()*.3,max:.55,color});
    }
  }
  function collectClocks(){
    if(mode!=='play')return;
    for(let i=0;i<clocks.length;){
      const item=clocks[i];
      if(storedClocks.length>=10||Math.hypot(item.x-player.x,item.y-player.y)>player.r+16){i++;continue}
      clocks.splice(i,1);burst(item.x,item.y,clockTypes[item.type].color,14);
      storedClocks.push(item.type);setHud();
    }
  }
  function useStoredClock(){
    if(mode!=='play'||storedClocks.length===0)return;
    const type=storedClocks.shift();startSelection(false,true,type);
  }
  function movePlayer(dx,dy){
    if(mode!=='play')return;
    const length=Math.hypot(dx,dy);if(length<.1)return;
    player.angle=Math.atan2(dy,dx);
    if(distance<=0)return;
    const scale=Math.min(1,distance*8/length),oldX=player.x,oldY=player.y;
    player.x=clamp(player.x+dx*scale,player.r+4,w-player.r-4);
    player.y=clamp(player.y+dy*scale,minY()+player.r,maxY()-player.r);
    distance=Math.max(0,distance-Math.hypot(player.x-oldX,player.y-oldY)/8);
    if(distance<.999)distance=0;
    setHud();collectClocks();checkExhausted();
  }
  function aimAt(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    const dx=clientX-rect.left-player.x,dy=clientY-rect.top-player.y;
    if(Math.hypot(dx,dy)>8)player.angle=Math.atan2(dy,dx);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='play')return;
    e.preventDefault();canvas.setPointerCapture(e.pointerId);
    drag.pointer=e.pointerId;drag.x=e.clientX;drag.y=e.clientY;aimAt(e.clientX,e.clientY);
  });
  canvas.addEventListener('pointermove',e=>{
    if(drag.pointer!==e.pointerId)return;
    e.preventDefault();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    drag.x=e.clientX;drag.y=e.clientY;
    if(distance>0)movePlayer(dx*.8,dy*.8);
    else aimAt(e.clientX,e.clientY);
  });
  function endDrag(e){if(drag.pointer===e.pointerId)drag.pointer=null}
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',endDrag);
  ui.clockButton.addEventListener('pointerdown',e=>{e.preventDefault();useStoredClock()});
  ui.attack.addEventListener('pointerdown',e=>{
    if(mode!=='play'||attacks<=0)return;
    e.preventDefault();ui.attack.setPointerCapture(e.pointerId);
    cancelCharge();charge.pointer=e.pointerId;charge.start=performance.now();
    if(attacks>=10){
      ui.attack.classList.add('charging');
      charge.timer=setTimeout(()=>{
        if(charge.pointer!==e.pointerId||mode!=='play'||attacks<10)return;
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
    for(let i=enemies.length-1;i>=0;i--){
      const enemy=enemies[i],dx=enemy.x-player.x,dy=enemy.y-player.y,len=Math.hypot(dx,dy);
      if(len>=player.r+enemy.r+51||(!fullCircle&&len>=25&&(dx*ax+dy*ay)/len<=-.2))continue;
      enemy.hp-=damage;enemy.hit=.18;burst(enemy.x,enemy.y,enemy.color,6);
      if(enemy.hp>0)continue;
      score++;burst(enemy.x,enemy.y,enemy.color,11);
      if(score%5===0)clocks.push({x:enemy.x,y:enemy.y,phase:Math.random()*6.28,type:['blue','green','red'][enemy.hpMax-1]});
      enemies.splice(i,1);
    }
  }
  function attack(){
    if(mode!=='play'||attacks<=0||swing>0||spin>0)return;
    attacks--;swing=.27;swingAngle=player.angle;
    hitEnemies(1,false);
    setHud();collectClocks();checkExhausted();
  }
  function spinAttack(){
    if(mode!=='play'||attacks<10||swing>0||spin>0)return;
    attacks-=10;spin=.55;swingAngle=player.angle;
    hitEnemies(5,true);
    setHud();collectClocks();checkExhausted();
  }
  function spawn(){
    const hp=1+Math.floor(Math.random()*3),edge=Math.floor(Math.random()*4),r=12+hp*2;
    let x,y;
    if(edge===0){x=-r;y=minY()+Math.random()*(maxY()-minY())}
    else if(edge===1){x=w+r;y=minY()+Math.random()*(maxY()-minY())}
    else if(edge===2){x=Math.random()*w;y=minY()-r}
    else{x=Math.random()*w;y=maxY()+r}
    enemies.push({x,y,r,hp,hpMax:hp,color:['#66c8ee','#74d590','#e97a83'][hp-1],speed:21+Math.random()*12+score*.3,hit:0,wobble:Math.random()*6.28});
  }
  function update(dt){
    if(mode!=='play')return;
    let dx=0,dy=0;
    if(keys.has('ArrowLeft')||keys.has('KeyA'))dx--;
    if(keys.has('ArrowRight')||keys.has('KeyD'))dx++;
    if(keys.has('ArrowUp')||keys.has('KeyW'))dy--;
    if(keys.has('ArrowDown')||keys.has('KeyS'))dy++;
    const length=Math.hypot(dx,dy);
    if(length){movePlayer(dx/length*124*dt,dy/length*124*dt);if(mode!=='play')return}
    collectClocks();if(mode!=='play')return;
    spawnTimer+=dt;
    if(spawnTimer>Math.max(.65,1.8-score*.02)){spawnTimer=0;spawn()}
    invincible=Math.max(0,invincible-dt);swing=Math.max(0,swing-dt);spin=Math.max(0,spin-dt);shake=Math.max(0,shake-dt);
    for(const enemy of enemies){
      enemy.wobble+=dt*5;enemy.hit=Math.max(0,enemy.hit-dt);
      const ex=player.x-enemy.x,ey=player.y-enemy.y,len=Math.hypot(ex,ey)||1;
      enemy.x+=ex/len*enemy.speed*dt;enemy.y+=ey/len*enemy.speed*dt;
      if(len<player.r+enemy.r-3&&invincible<=0){
        health--;invincible=1.15;shake=.2;burst(player.x,player.y,'#fff4dc',9);setHud();
        if(health<=0){gameOver();break}
      }
    }
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      if(p.life<=0)particles.splice(i,1);
    }
    checkExhausted();
  }
  function draw(now){
    ctx.clearRect(0,0,w,h);ctx.save();
    if(shake>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*5);
    const bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,'#253f46');bg.addColorStop(1,'#152b38');
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d6dfcf10';ctx.lineWidth=1;
    for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
    for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    ctx.strokeStyle='#e7d49e55';ctx.lineWidth=2;ctx.strokeRect(8,minY(),w-16,maxY()-minY());
    for(const item of clocks){
      const y=item.y+Math.sin(now/250+item.phase)*3;
      const color=clockTypes[item.type].color;
      ctx.globalAlpha=.2;ctx.fillStyle=color;ctx.beginPath();ctx.arc(item.x,y,23,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(item.x,y,15,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#23343c';ctx.beginPath();ctx.arc(item.x,y,11,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff0b5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(item.x,y);ctx.lineTo(item.x,y-7);ctx.moveTo(item.x,y);ctx.lineTo(item.x+5,y+2);ctx.stroke();
    }
    for(const enemy of enemies){
      const y=enemy.y+Math.sin(enemy.wobble)*2;
      ctx.fillStyle='#0b172277';ctx.beginPath();ctx.ellipse(enemy.x,y+enemy.r*.8,enemy.r,5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=enemy.hit>0?'#fff':enemy.color;ctx.beginPath();ctx.arc(enemy.x,y,enemy.r,Math.PI,0);
      ctx.quadraticCurveTo(enemy.x+enemy.r,y+enemy.r*.85,enemy.x,y+enemy.r*.7);
      ctx.quadraticCurveTo(enemy.x-enemy.r,y+enemy.r*.85,enemy.x-enemy.r,y);ctx.fill();
      ctx.fillStyle='#24333b';ctx.beginPath();ctx.arc(enemy.x-5,y-2,2,0,7);ctx.arc(enemy.x+5,y-2,2,0,7);ctx.fill();
    }
    for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,4,4)}
    ctx.globalAlpha=1;
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
    ctx.fillStyle='#f3eee0';ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,7);ctx.fill();
    ctx.fillStyle='#566d75';ctx.beginPath();ctx.arc(player.x,player.y,player.r-5,0,7);ctx.fill();
    ctx.strokeStyle='#e4c98e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(player.x,player.y);
    ctx.lineTo(player.x+Math.cos(player.angle)*18,player.y+Math.sin(player.angle)*18);ctx.stroke();
    ctx.globalAlpha=1;
    const label=String(Math.ceil(distance)),labelY=player.y-42;
    ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
    const labelW=Math.max(42,ctx.measureText(label).width+20);
    ctx.fillStyle='#102c39dd';ctx.fillRect(player.x-labelW/2,labelY-12,labelW,24);
    ctx.strokeStyle='#9ae0df';ctx.lineWidth=1;ctx.strokeRect(player.x-labelW/2,labelY-12,labelW,24);
    ctx.fillStyle='#c8f8ee';ctx.fillText(label,player.x,labelY);
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
