const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('attack-range.js','utf8'),context);
const contains=context.window.AttackRange.contains,G=require('../ground-effects.js'),AI=require('../sandbox-engine.js');
const assets=[3,1,2].map(i=>({asset_key:'flame_'+i,asset_type:'effect',owner_key:'fire_ground',sprite_file:String(i)}));
const effects=G.create(assets,contains,a=>({id:a.sprite_file,complete:true,naturalWidth:32}));
const body={x:48,y:48,r:0,angle:0},settings={range_px:70,angle_degrees:90,ground_effect_key:'fire_ground',ground_effect_duration_seconds:3,ground_effect_frame_seconds:.12,ground_effect_delay_seconds:.2};
effects.schedule(body,settings,.4,{width:4,height:4});body.x=999;settings.range_px=0;
effects.update(.59);assert.equal(effects.active.size,0,'wait until motion plus delay');effects.update(.02);assert(effects.active.size>0,'snapshot range survives attacker movement');
for(const effect of effects.active.values()){assert(effect.x>=0&&effect.y>=0&&effect.x<128&&effect.y<128);assert(contains({x:48,y:48,r:0,angle:0},{x:effect.x+16,y:effect.y+16,r:0},{range_px:70,angle_degrees:90}))}
let drawn=[];const ctx={save(){},restore(){},drawImage(image){drawn.push(image.id)}};
effects.draw(ctx);assert(drawn.every(id=>id==='1'));effects.update(.12);drawn=[];effects.draw(ctx);assert(drawn.every(id=>id==='2'));effects.update(.12);drawn=[];effects.draw(ctx);assert(drawn.every(id=>id==='3'));effects.update(.12);drawn=[];effects.draw(ctx);assert(drawn.every(id=>id==='1'),'loop');
const count=effects.active.size;effects.schedule({x:48,y:48,r:0,angle:0},{...settings,range_px:70,ground_effect_delay_seconds:0},0,{width:4,height:4});assert.equal(effects.active.size,count,'refresh same cells');effects.update(2.99);assert.equal(effects.active.size,count);effects.update(.02);assert.equal(effects.active.size,0);
effects.schedule(body,settings,1);effects.clear();assert.equal(effects.pending.length,0);
const enemy={x:48,y:48,r:14,angle:0,combatPhase:'attack',phaseRemaining:.1,attackDuration:.4,strikeDone:true},config={ai_attack_recovery_seconds:1};let finished=0;
const options={duration:.4,normal:{range_px:50,angle_degrees:90},onAttackFinished(){finished++},move(){},contains};AI.stepCombat(enemy,{x:90,y:48,r:14},.11,config,options);assert.equal(finished,1,'finish emits exactly once');AI.stepCombat(enemy,{x:90,y:48,r:14},.1,config,options);assert.equal(finished,1);
Object.assign(enemy,{combatPhase:'attack',phaseRemaining:.3});AI.cancelAttack(enemy,config);AI.stepCombat(enemy,{x:90,y:48,r:14},.4,config,options);assert.equal(finished,1,'cancelled attack never emits');
console.log('Ground effects: range cells, motion delay, snapshot, loop, bounds, lifetime, refresh and AI completion/cancellation passed');
