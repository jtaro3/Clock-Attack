const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const prefix of ['', 'dist/']){
 const {create}=require('../'+prefix+'drop-system.js');
 const data={items:{sand_blue:{effects:[{effect_type:'heal',value:20}]}},drops:{slime_blue:[{asset_key:'sand_blue',drop_weight:50,quantity:1},{asset_key:'sand_blue',drop_weight:10,quantity:3},{asset_key:'',drop_weight:40,quantity:0}]}};
 const enemy={enemyKey:'slime_blue',x:100,y:100};
 for(const [random,quantity] of [[0,1],[.49999,1],[.5,3],[.59999,3],[.6,0],[.99999,0]]){const system=create(data,()=>random);system.spawn(enemy);assert.equal(system.ground.reduce((sum,d)=>sum+d.quantity,0),quantity)}
 const system=create(data,()=>.5);system.spawn(enemy);const stock=[];
 assert.equal(system.collect({x:0,y:0,r:14},stock,10),0);
 assert.equal(system.collect({x:100,y:100,r:14},stock,2),2);assert.equal(system.ground[0].quantity,1);assert.equal(stock[0].recovery,20);assert.equal(stock[0].asset_key,'sand_blue');
 assert.equal(system.collect({x:100,y:100,r:14},stock,2),0);stock.pop();assert.equal(system.collect({x:100,y:100,r:14},stock,2),1);assert.equal(system.ground.length,0);
 const custom=create({...data,items:{sand_blue:{effects:[{effect_type:'heal',value:37},{effect_type:'heal',value:3}]}}},()=>0);assert.equal(custom.spawn(enemy).recovery,40);custom.reset();assert.equal(custom.ground.length,0);assert.equal(custom.spawn({...enemy,enemyKey:'slime_red'}),null);
 const src=fs.readFileSync(prefix+'game.js','utf8');const defeat=src.slice(src.indexOf('  function defeatEnemy('),src.indexOf('  function finishEnemyDamage('));
 const live=create(data,()=>.5);const c={drops:live,deadEnemies:[],score:0,roundKills:0,swordCount:0,MAX_SWORD_COUNT:150,timeSinceKill:0,enemies:[enemy],ui:{killWarning:{classList:{add(){}}}},burst(){},setHud(){},energy:50};vm.createContext(c);vm.runInContext(defeat,c);c.defeatEnemy(0,enemy);assert.equal(live.ground[0].quantity,3);assert.equal(c.energy,50);
 const use=src.slice(src.indexOf('  function useStoredClock('),src.indexOf('  function movePlayer('));const recoveryStock=[];live.collect({x:100,y:100,r:14},recoveryStock,10);let selection;const recoveryContext={mode:'play',unlocked:3,hitStop:0,sandBottles:recoveryStock,setHud(){},startSelection(...args){selection=args}};vm.createContext(recoveryContext);vm.runInContext(use,recoveryContext);recoveryContext.useStoredClock();assert.equal(selection[2],60);assert.equal(recoveryStock.length,0);assert.equal(recoveryContext.unlocked,0);
}
console.log('Weighted boundaries, no-drop, contact pickup, partial/full capacity, item recovery, kill integration and reset passed in root/dist');
