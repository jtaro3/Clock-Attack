(function(root){
  'use strict';
  function stepAI(enemy,player,dt,config){
    const dx=player.x-enemy.x,dy=player.y-enemy.y,distance=Math.hypot(dx,dy);
    if(enemy.aiType==='chase2'){
      if(!config){enemy.state='設定なし';return}
      if(!enemy.state||enemy.state==='設定なし')enemy.state='wait';
      if(enemy.state==='wait'){
        enemy.waitRemaining=Math.max(0,(enemy.waitRemaining||0)-dt);
        if(enemy.waitRemaining>0||distance>config.ai_detection_range_px)return;
        enemy.state='chase';
      }
      if(distance>config.ai_lose_target_range_px){enemy.state='wait';enemy.waitRemaining=config.ai_wait_seconds;return}
      if(distance<=config.ai_stop_distance_px){enemy.state='wait';enemy.waitRemaining=config.ai_wait_seconds;return}
    }else enemy.state='chase';
    if(!distance)return;
    enemy.angle=Math.atan2(dy,dx);
    const stop=enemy.aiType==='chase2'?config.ai_stop_distance_px:0;
    const move=Math.min(enemy.speed*dt,Math.max(0,distance-stop));
    enemy.x+=dx/distance*move;enemy.y+=dy/distance*move;
  }
  function reactions(config,armor,attacking){
    if(armor)return {flinch:false,knockback:false};
    const suffix=attacking?'during_attack':'normal';
    return {flinch:Number(config?.['ai_flinch_'+suffix]??0)===1,knockback:Number(config?.['ai_knockback_'+suffix]??1)===1};
  }
  function cancelAttack(enemy,config){enemy.combatPhase='recovery';enemy.phaseRemaining=Number(config.ai_attack_recovery_seconds)||0;enemy.attackTime=0;enemy.pendingAttack=false;enemy.state='recovery'}
  function stepCombat(enemy,player,dt,config,options){
    const number=(key,fallback=0)=>Math.max(0,Number(config[key]??fallback));
    const face=()=>enemy.angle=Math.atan2(player.y-enemy.y,player.x-enemy.x);
    const move=()=>{
      const previous=enemy.aiType;enemy.aiType='chase2';
      const x=enemy.x,y=enemy.y;stepAI(enemy,player,dt,config);const dx=enemy.x-x,dy=enemy.y-y;enemy.x=x;enemy.y=y;enemy.aiType=previous;
      options.move(enemy,dx,dy);
      if(number('ai_obstacle_handling')===1&&options.blocked&&Math.hypot(dx,dy)>0&&Math.hypot(enemy.x-x,enemy.y-y)<Math.hypot(dx,dy)*.5){
        enemy.pathRetry=Math.max(0,(enemy.pathRetry||0)-dt);
        if(!enemy.pathRetry){enemy.pathPoint=findWaypoint(enemy,player,options.blocked);enemy.pathRetry=.25}
        const point=enemy.pathPoint;
        if(point){const px=point.x-enemy.x,py=point.y-enemy.y,len=Math.hypot(px,py);if(len)options.move(enemy,px/len*enemy.speed*dt,py/len*enemy.speed*dt)}
      }
    };
    let hit=false;
    if(!enemy.combatPhase)enemy.combatPhase='chase';
    if(enemy.combatPhase==='chase'){
      face();
      if(Math.hypot(player.x-enemy.x,player.y-enemy.y)<=number('ai_detection_range_px')&&options.contains(enemy,player,options.normal)){
        enemy.combatPhase='prepare';enemy.phaseRemaining=number('ai_attack_preparation_seconds');enemy.state='prepare';
      }else move();
    }else if(enemy.combatPhase==='prepare'){
      face();enemy.phaseRemaining-=dt;
      if(enemy.phaseRemaining<=0){enemy.combatPhase='attack';enemy.phaseRemaining=options.duration;enemy.attackDuration=options.duration;enemy.attackTime=options.duration;enemy.attackAngle=enemy.angle;enemy.strikeDone=false;enemy.state='attack';options.onAttackStarted?.()}
    }else if(enemy.combatPhase==='attack'){
      if(number('ai_move_during_attack')===1){const angle=enemy.attackAngle;options.move(enemy,Math.cos(angle)*enemy.speed*dt,Math.sin(angle)*enemy.speed*dt)}
      enemy.phaseRemaining=Math.max(0,enemy.phaseRemaining-dt);enemy.attackTime=enemy.phaseRemaining;
      if(!enemy.strikeDone&&enemy.phaseRemaining<=options.duration/2){enemy.strikeDone=true;hit=options.contains({...enemy,angle:enemy.attackAngle},player,options.normal)}
      if(enemy.phaseRemaining===0){options.onAttackFinished?.();cancelAttack(enemy,config)}
    }else{
      enemy.phaseRemaining-=dt;
      if(enemy.phaseRemaining<=0){enemy.combatPhase='chase';enemy.state='wait';enemy.waitRemaining=number('ai_wait_seconds')}
    }
    if(number('ai_contact_damage_enabled')===1&&options.contains(enemy,player,options.contact,true))hit=true;
    return hit;
  }
  // Grid search is used only when direct movement is blocked. The caller supplies map collision.
  function findWaypoint(enemy,target,blocked){
    const size=32,start={x:Math.floor(enemy.x/size),y:Math.floor(enemy.y/size)},goal={x:Math.floor(target.x/size),y:Math.floor(target.y/size)};
    const key=p=>p.x+','+p.y,queue=[start],parents=new Map([[key(start),null]]);let end=null;
    for(let i=0;i<queue.length&&i<4096;i++){
      const p=queue[i];if(p.x===goal.x&&p.y===goal.y){end=p;break}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:p.x+dx,y:p.y+dy};if(parents.has(key(next))||blocked(next.x*size+16,next.y*size+16,enemy.r))continue;parents.set(key(next),p);queue.push(next)}
    }
    if(!end)return null;let previous=parents.get(key(end));while(previous&&key(previous)!==key(start)){end=previous;previous=parents.get(key(end))}return {x:end.x*size+16,y:end.y*size+16};
  }
  const api={stepAI,stepCombat,reactions,cancelAttack,findWaypoint};root.SandboxAI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
