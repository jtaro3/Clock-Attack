(function(root){
  'use strict';
  function cells(body,settings,contains,limits){
    const radius=Math.max(0,body.r+Number(settings.range_px||0)),result=[];
    for(let y=Math.floor((body.y-radius)/32);y<=Math.floor((body.y+radius)/32);y++){
      for(let x=Math.floor((body.x-radius)/32);x<=Math.floor((body.x+radius)/32);x++){
        if(limits&&(x<0||y<0||x>=limits.width||y>=limits.height))continue;
        if(contains(body,{x:x*32+16,y:y*32+16,r:0},settings))result.push({x:x*32,y:y*32});
      }
    }
    return result;
  }
  function create(assets,contains,loadImage){
    const groups=new Map(),active=new Map(),pending=[];
    for(const asset of assets||[]){
      if(asset.asset_type!=='effect'||asset.enabled===false||String(asset.enabled)==='0')continue;
      const key=String(asset.owner_key||'').trim();if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(asset);
    }
    for(const [key,frames] of groups)groups.set(key,frames.sort((a,b)=>a.asset_key.localeCompare(b.asset_key,'en',{numeric:true})).map(asset=>loadImage(asset)));
    function spawn(body,settings,limits,age=0){
      const key=String(settings?.ground_effect_key||'').trim(),duration=Number(settings?.ground_effect_duration_seconds),frames=groups.get(key);
      if(!frames?.length||!(duration>age))return;
      for(const point of cells(body,settings,contains,limits)){
        const id=key+':'+point.x+':'+point.y;
        // Replacing an existing cell refreshes its lifetime without duplicate drawing.
        active.set(id,{...point,key,age,remaining:duration-age,frameSeconds:Number(settings.ground_effect_frame_seconds)||.12});
      }
    }
    function schedule(body,settings,motionSeconds=0,limits){
      if(!settings?.ground_effect_key)return;
      const delay=Math.max(0,motionSeconds)+Math.max(0,Number(settings.ground_effect_delay_seconds)||0);
      if(delay===0)spawn({...body},{...settings},limits);
      else pending.push({body:{...body},settings:{...settings},limits,delay});
    }
    function update(dt){
      for(const [id,effect] of active){effect.age+=dt;effect.remaining-=dt;if(effect.remaining<=0)active.delete(id)}
      for(let i=pending.length-1;i>=0;i--){const effect=pending[i];effect.delay-=dt;if(effect.delay<=0){pending.splice(i,1);spawn(effect.body,effect.settings,effect.limits,-effect.delay)}}
    }
    function draw(ctx){
      ctx.save();ctx.imageSmoothingEnabled=false;
      for(const effect of active.values()){
        const frames=groups.get(effect.key),image=frames[Math.floor(effect.age/effect.frameSeconds)%frames.length];
        if(image?.complete&&image.naturalWidth>0)ctx.drawImage(image,effect.x,effect.y,32,32);
      }
      ctx.restore();
    }
    return {schedule,update,draw,clear(){active.clear();pending.length=0},active,pending};
  }
  const api={cells,create};root.ClockAttackGroundEffects=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
