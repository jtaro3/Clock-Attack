(()=>{
  'use strict';
  const radii={slime_blue:14,slime_green:16,slime_red:18,slime_purple:22,slime_black:24,slime_metal:26};
  function enemyRadius(key,data){const value=data?.collision_radius_px;return value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):radii[key]||14}
  function contains(attacker,target,settings,contact=false){
    if(!settings)return false;
    const dx=target.x-attacker.x,dy=target.y-attacker.y,distance=Math.hypot(dx,dy);
    const radius=Math.max(0,attacker.r+Number(settings.range_px)-(contact?3:0)),targetRadius=Math.max(0,target.r);
    const angle=Number(settings.angle_degrees);
    if(angle<=0)return false;
    if(distance>radius+targetRadius)return false;
    if(angle>=360||distance===0)return true;
    const half=angle*Math.PI/360,direction=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(direction-attacker.angle),Math.cos(direction-attacker.angle));
    if(Math.abs(delta)<=half)return Math.max(0,distance-radius)<=targetRadius;
    // Outside the sector: closest point lies on one of the two radial edges.
    for(const edge of [attacker.angle-half,attacker.angle+half]){
      const ux=Math.cos(edge),uy=Math.sin(edge),along=Math.max(0,Math.min(radius,dx*ux+dy*uy));
      if(Math.hypot(dx-ux*along,dy-uy*along)<=targetRadius)return true;
    }
    return false;
  }
  function enemySpriteSize(data){const value=data?.sprite_size_px;return value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):56}
  window.AttackRange={enemyRadius,enemySpriteSize,contains};
})();
