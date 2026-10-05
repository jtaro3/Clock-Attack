const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const prefix of ['', 'dist/']){
 const s=fs.readFileSync(prefix+'game.js','utf8');
 const limit=s.match(/const GRAY_STATE_HIT_LIMIT=.*?;/)[0];
 const hit=s.match(/if\(energy===0&&unlocked>0\)\{grayHits=.*?\}/)[0];
 const width=s.match(/ui\.grayDamageFill\.style\.width=.*?;/)[0];
 for(const value of [1,3,5,9,undefined]){
  const c={general:value===undefined?{}:{gray_state_hit_limit:value},setting:(o,k,f)=>o[k]??f,energy:0,unlocked:1,grayHits:0,setHud(){},ui:{grayDamageFill:{style:{}}}};
  vm.createContext(c);vm.runInContext(limit,c);const max=value??3;
  for(let i=1;i<=max;i++){vm.runInContext(hit+'; ended=grayHits>=GRAY_STATE_HIT_LIMIT;'+width,c);assert.equal(c.ended,i===max);assert.equal(c.grayHits,i);assert.equal(c.ui.grayDamageFill.style.width,`${i/max*100}%`)}
  vm.runInContext(hit,c);assert.equal(c.grayHits,max);
 }
 assert(!s.includes('grayHits>=3'));assert(!s.includes('grayHits/3'));
 const data=JSON.parse(fs.readFileSync(prefix+'game-data.json','utf8'));assert.equal(data.general.gray_state_hit_limit,5);
}
console.log('Master limits 1/3/5/9, fallback, hit saturation, gauge and root/dist current value passed');
