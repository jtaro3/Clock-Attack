const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['game.js','dist/game.js']){
  const source=fs.readFileSync(file,'utf8');
  const defeat=source.slice(source.indexOf('  function defeatEnemy('),source.indexOf('  function finishEnemyDamage('));
  const enemy={hpMax:20,kind:'black',color:'#000',x:10,y:20,deathHitStop:.15};
  const bottles=[{recovery:40}];let hudCalls=0;
  let dropCalls=0;
  const c={drops:{spawn(){dropCalls++}},deadEnemies:[],score:0,roundKills:0,swordCount:1,MAX_SWORD_COUNT:150,sandBottles:bottles,unlocked:1,energy:30,timeSinceKill:20,enemies:[enemy],ui:{killWarning:{classList:{add(){}}}},burst(){},setHud(){hudCalls++}};
  vm.createContext(c);vm.runInContext(defeat,c);
  assert.equal(c.defeatEnemy(0,enemy),.15);
  assert.equal(dropCalls,1);assert.equal(c.enemies.length,0);assert.equal(c.deadEnemies.length,1);
  assert.equal(c.score,1);assert.equal(c.roundKills,1);assert.equal(c.swordCount,2);
  assert.deepEqual(c.sandBottles,[{recovery:40}]);assert.equal(c.unlocked,1);assert.equal(c.energy,30);
  assert.equal(c.timeSinceKill,0);assert.equal(hudCalls,1);
  c.sandBottles.length=0;c.unlocked=0;c.enemies.push(enemy);c.defeatEnemy(0,enemy);
  assert.equal(c.sandBottles.length,0);assert.equal(c.unlocked,0);assert.equal(c.energy,30);
}
console.log('Enemy kills preserve counters and existing stock without adding sand or healing (root and dist).');
