const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('game.js','utf8');
const spawn=source.slice(source.indexOf('  function spawn(){'),source.indexOf('  function update(dt){'));
const finish=source.slice(source.indexOf('  function finishEnemyDamage('),source.indexOf('  function hitObjects('));
function setup(rules){const blue={enemyKey:'slime_blue',hp:1,attack:1,radius:14},green={...blue,enemyKey:'slime_green'};
const c={round:1,roundKills:0,roundSpawned:0,roundElapsed:0,roundSpawnCounts:{},spawnTimer:0,MAX_ENEMIES:20,enemies:[],currentRoundConfig:()=>({spawns:rules}),roundKillTarget:()=>10,SLIME_BY_KEY:{slime_blue:blue,slime_green:green},enemyData:{slime_blue:{},slime_green:{}},player:{x:100,y:100},map:{width:100,height:100},obstacles:[],WorldSpawn:{around:()=>({x:50,y:50})},setting:(s,k,f)=>s[k]??f,blueSlimeTuning:{moveSpeed:18},score:0,BLUE_SLIME_LOOP_SECONDS:1,Math,hitStop:0,drag:{pointer:null},activeRounds:[1,3],cleared:false,gameClear(){c.cleared=true}};
vm.createContext(c);vm.runInContext(spawn+'\n'+finish,c);return c}
const row=(extra={})=>({enemy_key:'slime_blue',spawn_weight:45,max_alive:0,max_per_round:0,start_elapsed_seconds:0,guaranteed_once:false,...extra});
let c=setup([row()]);c.spawn();assert.equal(c.enemies[0].enemyKey,'slime_blue');
for(const rows of [[],[row({start_elapsed_seconds:10})],[row({max_per_round:1})],[row({max_alive:1})]]){
 c=setup(rows);c.roundSpawnCounts.slime_blue=1;if(rows[0]?.max_alive)c.enemies.push({enemyKey:'slime_blue'});const before=c.enemies.length;c.spawn();assert.equal(c.enemies.length,before)}
c=setup([row(),row({enemy_key:'slime_green',spawn_weight:.01,guaranteed_once:true,start_elapsed_seconds:5})]);c.roundElapsed=5;c.spawn();assert.equal(c.enemies[0].enemyKey,'slime_green');assert.equal(c.roundSpawnCounts.slime_green,1);
c=setup([row()]);c.roundKills=10;c.finishEnemyDamage(false);assert.equal(c.round,3);c.roundKills=10;c.finishEnemyDamage(false);assert.equal(c.cleared,true);
assert(!source.includes('spawn(true)'));console.log('Master-controlled spawn and round tests passed');
