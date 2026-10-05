(()=>{
  'use strict';
  const radii={slime_blue:14,slime_green:16,slime_red:18,slime_purple:22,slime_black:24,slime_metal:26};
  function enemyRadius(key){return radii[key]||14}
  function contains(attacker,target,settings,contact=false){
    if(!settings)return false;
    const dx=target.x-attacker.x,dy=target.y-attacker.y,distance=Math.hypot(dx,dy);
    const limit=attacker.r+target.r+Number(settings.range_px)-(contact?3:0);
    if(distance>=limit)return false;
    const angle=Number(settings.angle_degrees);
    if(angle>=360)return true;
    if(angle<=0)return false;
    if(distance===0)return true;
    return (dx*Math.cos(attacker.angle)+dy*Math.sin(attacker.angle))/distance>Math.cos(angle*Math.PI/360);
  }
  window.AttackRange={enemyRadius,contains};
})();
