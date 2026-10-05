(function(root){
  'use strict';
  const folders={player:'design/player/',items:'design/items/'};
  const directions=['back','back_right','right','front_right','front','front_left','left','back_left'];
  function path(asset){
    const folder=folders[asset?.asset_type],file=String(asset?.sprite_file||'').trim();
    if(!folder||!file||/[\\/]/.test(file)||file==='.'||file==='..')return null;
    return folder+encodeURIComponent(file);
  }
  function create(assets=[]){
    const enabled=assets.filter(asset=>asset.enabled===undefined||asset.enabled===true||String(asset.enabled)==='1');
    return {
      get:key=>enabled.find(asset=>asset.asset_key===key),
      playerFiles:()=>directions.map(direction=>path(enabled.find(asset=>asset.asset_type==='player'&&asset.owner_key==='player'&&asset.direction===direction))),
      itemPath:key=>{const asset=enabled.find(asset=>asset.asset_key===key&&asset.asset_type==='items');return path(asset)}
    };
  }
  const api={path,create,directions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ClockAttackAssets=api;
})(typeof window!=='undefined'?window:globalThis);
