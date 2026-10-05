const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const prefix of ['', 'dist/']){
 const src=fs.readFileSync(prefix+'game.js','utf8');const start=src.slice(src.indexOf('  const requestedDifficulty='),src.indexOf('  const SLIME_TYPES='));
 const data={'easy|1':{kill_target:10,spawns:[{enemy_key:'slime_blue'}]},'normal|1':{kill_target:25,spawns:[{enemy_key:'slime_green'}]},'hard|1':{kill_target:40,spawns:[{enemy_key:'slime_red'}]},'hard|2':{kill_target:50,spawns:[]}};
 for(const [key,target,enemy] of [['easy',10,'slime_blue'],['normal',25,'slime_green'],['hard',40,'slime_red'],['invalid',10,'slime_blue']]){
  const c={query:new URLSearchParams('difficulty='+key),gameData:{difficulties:{easy:{max_round:99},normal:{max_round:99},hard:{max_round:99}}},roundData:data,MAX_EASY_ROUND:3,setting:(s,k,f)=>s[k]??f,round:0,ui:{panel:{}},enemyType(){}};
  vm.runInNewContext(start.replace("if(!activeRounds.length){ui.panel.textContent='有効なラウンドがありません。roundとdifficultyのマスターを確認してください。';return}","if(!activeRounds.length)throw Error('missing rounds');")+'; result={rounds:activeRounds,target:roundKillTarget(1),enemy:currentRoundConfig(1).spawns[0].enemy_key};',c);
  assert.equal(c.result.target,target);assert.equal(c.result.enemy,enemy);assert.deepEqual(Array.from(c.result.rounds),key==='hard'?[1,2]:[1]);
 }
}
console.log('Same-number rounds and enemy rules isolated per difficulty in root/dist');
