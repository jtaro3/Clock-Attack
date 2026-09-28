(()=>{
  'use strict';
  function around(x,y,distance,width,height,r,obstacles,random=Math.random){
    const start=random()*Math.PI*2;
    for(let i=0;i<96;i++){
      const angle=start+i*Math.PI*2/96;
      const point={x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance};
      if(point.x<r||point.y<r||point.x>width-r||point.y>height-r)continue;
      if(!MapCollision.blocked(point.x,point.y,r,obstacles))return point;
    }
    return null;
  }
  window.WorldSpawn={around};
})();
