(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ClockAttackDrops=factory()})(globalThis,()=>{
  'use strict';
  const colors={blue:'#66c8ee',green:'#74d590',red:'#e97a83',purple:'#b679e5',black:'#171a20',white:'#bec8d1'};
  function create(data,random=Math.random){
    const ground=[];let money=0;
    function spawn(enemy){
      const rows=data.drops?.[enemy.enemyKey]||[],total=rows.reduce((sum,row)=>sum+row.drop_weight,0);
      if(total<=0)return null;
      let ticket=random()*total,selected=null;
      for(const row of rows){ticket-=row.drop_weight;if(ticket<0){selected=row;break}}
      if(!selected?.asset_key||selected.quantity<=0)return null;
      const item=data.items?.[selected.asset_key];
      if(!item)return null;
      const isMoney=item.effects.length===1&&item.effects[0].effect_type==='money';
      const recovery=item.effects.reduce((sum,effect)=>sum+(effect.effect_type==='heal'?effect.value:0),0);
      const kind=selected.asset_key.replace(/^sand_/,'');
      const drop={asset_key:selected.asset_key,isMoney,kind,color:colors[kind]||'#fff9e8',recovery,quantity:selected.quantity,x:enemy.x,y:enemy.y,r:10};
      ground.push(drop);return drop;
    }
    function collect(player,stock,capacity){
      let picked=0;
      for(let i=0;i<ground.length;){
        const drop=ground[i];
        if(Math.hypot(player.x-drop.x,player.y-drop.y)>player.r+drop.r){i++;continue}
        if(drop.isMoney){money+=drop.quantity;picked+=drop.quantity;ground.splice(i,1);continue}
        const count=Math.max(0,Math.min(drop.quantity,capacity-stock.length));
        for(let n=0;n<count;n++)stock.push({asset_key:drop.asset_key,kind:drop.kind,color:drop.color,recovery:drop.recovery});
        drop.quantity-=count;picked+=count;
        if(!drop.quantity)ground.splice(i,1);else i++;
      }
      return picked;
    }
    return {ground,spawn,collect,get money(){return money},reset(){ground.length=0;money=0}};
  }
  return {create};
});
