(()=>{
  const viewScale=.8;
  window.BattleMapBounds={viewScale,outer(w,h){
    const top=Math.max(92/viewScale,h*.12),bottom=Math.max(top+60,h-130/viewScale);
    return {left:4,top,right:w-4,bottom};
  },centers(rect,extent){
    return {left:Math.min((rect.left+rect.right)/2,rect.left+extent.x+2),right:Math.max((rect.left+rect.right)/2,rect.right-extent.x-2),top:Math.min((rect.top+rect.bottom)/2,rect.top+extent.top+2),bottom:Math.max((rect.top+rect.bottom)/2,rect.bottom-extent.bottom-2)};
  }};
})();
