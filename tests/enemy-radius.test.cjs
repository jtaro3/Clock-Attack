const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const ctx={window:{}};vm.runInNewContext(fs.readFileSync('attack-range.js','utf8'),ctx);const api=ctx.window.AttackRange;
assert.equal(api.enemyRadius('slime_blue',{collision_radius_px:1}),1);
assert.equal(api.enemyRadius('slime_green',{collision_radius_px:30}),30);
assert.equal(api.enemyRadius('slime_green',{}),16);
assert.equal(api.enemyRadius('slime_blue',{collision_radius_px:''}),14);
const target={x:40,y:0,r:14},range={range_px:0,angle_degrees:360};
assert.equal(api.contains({x:0,y:0,r:1,angle:0},target,range),false);assert.equal(api.contains({x:0,y:0,r:30,angle:0},target,range),true);
console.log('Master enemy radius: passed');
