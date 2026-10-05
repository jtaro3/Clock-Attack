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
  const api={stepAI};root.SandboxAI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
