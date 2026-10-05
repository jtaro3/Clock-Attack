(()=>{
  'use strict';
  function create(map,catalog){
    const originalTiles=map.tiles.slice(),targets=[];
    const floor=Math.max(0,catalog.findIndex(t=>t.walkable===true&&!t.destructible));
    function add(id,x,y,index,object){
      const t=catalog[id];if(!t?.destructible||!(t.hp>0))return;
      const width=(Number(t.collision_width)||object?.width_tiles||1)*32;
      const height=(Number(t.collision_length)||object?.height_tiles||1)*32;
      targets.push({id,index,object,left:x*32,top:y*32,right:x*32+width,bottom:y*32+height,hp:t.hp,maxHp:t.hp,destroyed:false});
    }
    map.tiles.forEach((id,i)=>add(id,i%map.width,Math.floor(i/map.width),i,null));
    (map.objects||[]).forEach(o=>add(o.id,o.x,o.y,null,o));
    function activeMap(){return {...map,objects:(map.objects||[]).filter(o=>!o.destroyed)}}
    function hit(x,y,angle,range,damage,fullCircle,angleDegrees=203){
      const hits=[];
      for(const t of targets){
        if(t.destroyed)continue;
        const nx=Math.max(t.left,Math.min(t.right,x)),ny=Math.max(t.top,Math.min(t.bottom,y));
        const dx=nx-x,dy=ny-y,distance=Math.hypot(dx,dy);
        if(distance>range||(!fullCircle&&angleDegrees<360&&distance>0&&(dx*Math.cos(angle)+dy*Math.sin(angle))/distance<=Math.cos(angleDegrees*Math.PI/360)))continue;
        t.hp=Math.max(0,t.hp-damage);
        if(t.hp===0){t.destroyed=true;if(t.object)t.object.destroyed=true;else map.tiles[t.index]=floor;}
        hits.push({x:nx,y:ny,hp:t.hp,destroyed:t.destroyed,damage});
      }
      return hits;
    }
    function reset(){map.tiles.splice(0,map.tiles.length,...originalTiles);for(const t of targets){t.hp=t.maxHp;t.destroyed=false;if(t.object)delete t.object.destroyed;}}
    return {targets,activeMap,hit,reset};
  }
  window.MapDestruction={create};
})();
