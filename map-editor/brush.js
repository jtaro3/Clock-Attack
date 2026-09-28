(()=>{
  const directions=[[1,0],[0,1],[1,1],[1,-1]];
  window.MapBrush={directions,cells(x,y,length,direction,width,height){
    const [dx,dy]=directions[direction],cells=[];
    for(let offset=-Math.floor(length/2);offset<=Math.floor(length/2);offset++){
      const px=x+dx*offset,py=y+dy*offset;
      if(px>=0&&py>=0&&px<width&&py<height)cells.push({x:px,y:py});
    }
    return cells;
  }};
})();
