(()=>{
  'use strict';
  function build(map,catalog){
    const rects=[];
    function add(id,x,y){
      const tile=catalog[id];
      if(!tile||tile.walkable!==false)return;
      const width=Number(tile.collision_width)*32,height=Number(tile.collision_length)*32;
      if(width>0&&height>0)rects.push({left:x*32,top:y*32,right:x*32+width,bottom:y*32+height});
    }
    map.tiles.forEach((id,index)=>add(id,index%map.width,Math.floor(index/map.width)));
    (map.objects||[]).forEach(o=>add(o.id,o.x,o.y));
    return rects;
  }
  function blocked(x,y,r,rects){
    return rects.some(b=>{const nx=Math.max(b.left,Math.min(b.right,x)),ny=Math.max(b.top,Math.min(b.bottom,y));return (x-nx)**2+(y-ny)**2<r*r});
  }
  function move(x,y,dx,dy,r,rects){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
    for(let i=0;i<steps;i++){
      if(!blocked(x+dx/steps,y,r,rects))x+=dx/steps;
      if(!blocked(x,y+dy/steps,r,rects))y+=dy/steps;
    }
    return {x,y};
  }
  window.MapCollision={build,blocked,move};
})();
