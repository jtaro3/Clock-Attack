const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('game.js','utf8');
const section=source.slice(source.indexOf('  const requestedDifficulty='),source.indexOf('  if(!activeRounds.length)'));
function rounds(key,count=10){const context={query:new URLSearchParams(key?'difficulty='+key:''),gameData:{difficulties:{easy:{max_round:3},normal:{max_round:6},hard:{max_round:10}}},roundData:Object.fromEntries(Array.from({length:count},(_,i)=>[i+1,{}])),MAX_EASY_ROUND:3,setting:(s,k,f)=>s[k]??f};vm.runInNewContext(section+'; result=activeRounds;',context);return Array.from(context.result)}
assert.equal(rounds('easy').length,3);assert.equal(rounds('normal').length,6);assert.equal(rounds('hard').length,10);assert.equal(rounds('hard',5).length,5,'無効ラウンドは追加しない');assert.equal(rounds('invalid').length,3);assert.equal(rounds('').length,3);
console.log('Difficulty round limits: passed');
