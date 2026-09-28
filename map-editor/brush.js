(()=>{
  const directions=[[1,0],[0,1],[1,1],[1,-1]];
  window.MapBrush={directions,cells(x,y,length,direction,width,height,shape='line'){
    const [dx,dy]=directions[direction],cells=[];
    if(shape==='square'){
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
        const px=x+ox,py=y+oy;
        if(px>=0&&py>=0&&px<width&&py<height)cells.push({x:px,y:py});
      }
      return cells;
    }
    for(let offset=-Math.floor(length/2);offset<=Math.floor(length/2);offset++){
      const px=x+dx*offset,py=y+dy*offset;
      if(px>=0&&py>=0&&px<width&&py<height)cells.push({x:px,y:py});
    }
    return cells;
  }};
})();
