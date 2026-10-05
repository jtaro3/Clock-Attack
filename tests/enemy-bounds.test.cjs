const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const prefix of ['', 'dist/']){
 const c={window:{},map:{width:20,height:20},player:{x:100,y:100},obstacles:[],clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),mapOffset:()=>({x:0,y:0}),playerMovementBounds:()=>({left:50,right:590,top:60,bottom:580})};vm.createContext(c);
 vm.runInContext(fs.readFileSync(prefix+'movement-bounds.js','utf8')+'\n'+fs.readFileSync(prefix+'map-collision.js','utf8'),c);c.MapCollision=c.window.MapCollision;c.BattleMapBounds=c.window.BattleMapBounds;
 const src=fs.readFileSync(prefix+'game.js','utf8');vm.runInContext(src.slice(src.indexOf('  function moveBody('),src.indexOf('  function ensurePlayerFree(')),c);
 for(const [x,y,dx,dy,expectedX,expectedY] of [[35,100,-500,0,30,100],[605,100,500,0,610,100],[100,50,0,-500,100,44],[100,600,0,500,100,608],[35,50,-500,-500,30,44]]){
  const enemy={x,y};c.moveBody(enemy,dx,dy,14);assert(Math.abs(enemy.x-expectedX)<1e-8);assert(Math.abs(enemy.y-expectedY)<1e-8);
  for(let i=0;i<10;i++)c.moveBody(enemy,dx,dy,14);assert(enemy.x>=30&&enemy.x<=610&&enemy.y>=44&&enemy.y<=608);
 }
 const enemy={x:100,y:100};c.obstacles=[{left:120,top:50,right:160,bottom:150}];c.moveBody(enemy,500,0,14);assert(enemy.x<=106,'Obstacle must still stop knockback');assert(!c.MapCollision.blocked(enemy.x,enemy.y,14,c.obstacles));
 c.obstacles=[];c.moveBody(c.player,-500,-500,10,14);assert(Math.abs(c.player.x-50)<1e-8);assert(Math.abs(c.player.y-60)<1e-8);
}
console.log('Four edges, diagonal/repeated knockback, obstacle collision and player bounds passed in root/dist');
