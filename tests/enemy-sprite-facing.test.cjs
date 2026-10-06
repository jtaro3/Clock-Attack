const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const shared={window:{}};vm.runInNewContext(fs.readFileSync('attack-range.js','utf8'),shared);const api=shared.window.AttackRange;
function renderer(){
  const calls=[],stack=[];let sign=1;
  const ctx=new Proxy({save(){stack.push(sign)},restore(){sign=stack.pop()},scale(x){sign*=x},drawImage(image){calls.push({image,sign})}},{get:(object,key)=>object[key]||(()=>{})});
  return {ctx,calls};
}
const sandbox=fs.readFileSync('sandbox.js','utf8');
const draw=sandbox.slice(sandbox.indexOf('  function draw(){'),sandbox.indexOf('  function point('));
const game=fs.readFileSync('game.js','utf8'),gameStart=game.indexOf('        const spriteSize=AttackRange.enemySpriteSize');
const gameSprite=game.slice(gameStart,game.indexOf('      }else{',gameStart));
const preview=fs.readFileSync('animation-preview.js','utf8');
const previewFunctions=preview.slice(preview.indexOf('  function drawImage('),preview.indexOf('  function drawRangePreview('));
for(const facing of ['left','right'])for(const angle of [0,Math.PI]){
  const data={sprite_facing:facing,sprite_size_px:94},expected=(facing==='left')!==(angle===Math.PI)?-1:1;
  assert.equal(api.enemySpriteFlipped(angle,data),expected===-1);
  // Exercise the sandbox's actual drawing code; the enemy marker identifies its draw call.
  const r=renderer(),image={enemy:true},elements={};
  const c={ctx:r.ctx,W:640,H:480,p:{x:100,y:100,r:14,angle:0,hp:10},e:{x:200,y:100,r:47,angle,hp:10},$:id=>elements[id]||(elements[id]={checked:false}),playerAttackRange:null,enemyAttackRange:null,playerImages:[],frame:()=>image,time:0,enemyAttackUntil:0,playerAttackUntil:0,AttackRange:api,data:{enemies:{dragon:data}},selected:'dragon',values:{php:10,ehp:10},notice:'',running:false};
  vm.runInNewContext(draw+'draw();',c);assert.equal(r.calls.find(call=>call.image===image).sign,expected,'sandbox must face its target');
  // Both moving/attacking sprites and the white hit flash must share orientation.
  for(const attack of [false,true]){
    const r=renderer(),sprite={},flash={};
    vm.runInNewContext(gameSprite,{ctx:r.ctx,AttackRange:api,enemyData:{dragon:data},enemy:{enemyKey:'dragon',x:0,y:0,angle,attackAngle:angle,hit:.1},player:{x:100,y:0},y:0,spriteFrame:{attack,image:sprite,flash},clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
    assert.deepEqual(r.calls.map(call=>call.sign),[expected,expected],'game image and damage flash must align');
  }
  const r2=renderer(),item={image:{}};
  vm.runInNewContext(previewFunctions+'drawEnemyImage(item,10,20,angle);',{ctx:r2.ctx,AttackRange:api,enemyMasterData:{dragon:data},enemyKey:'dragon',item,angle});
  assert.equal(r2.calls[0].sign,expected,'preview uses master facing');
}
assert.equal(api.enemySpriteFlipped(0,{}),false,'old masters default to right-facing');
assert.equal(api.enemySpriteFlipped(Math.PI,{}),true);
console.log('Enemy facing: left/right source images track both directions in sandbox, game, flash and preview');
