const assert=require('node:assert/strict');
for(const prefix of ['', 'dist/']){
 const {create}=require('../'+prefix+'drop-system.js');
 const data={items:{money:{effects:[{effect_type:'money',value:0}]},sand_blue:{effects:[{effect_type:'heal',value:20}]}},drops:{slime_blue:[{asset_key:'money',quantity:25,drop_weight:1}],slime_green:[{asset_key:'sand_blue',quantity:1,drop_weight:1}]}};
 const d=create(data,()=>0),enemy={enemyKey:'slime_blue',x:100,y:100};
 assert(d.spawn(enemy).isMoney);assert.equal(d.money,0);
 const stock=[{recovery:20}];assert.equal(d.collect({x:0,y:0,r:14},stock,1),0);assert.equal(d.money,0);
 d.spawn({...enemy,enemyKey:'slime_green'});d.ground.reverse();assert.equal(d.collect({x:100,y:100,r:14},stock,1),25);assert.equal(d.money,25);assert.equal(stock.length,1);assert.equal(d.ground.length,1,'Full bottle stock must not prevent currency collection');
 d.spawn(enemy);d.collect({x:100,y:100,r:14},stock,1);assert.equal(d.money,50);assert.equal(stock[0].recovery,20);
 stock.length=0;d.collect({x:100,y:100,r:14},stock,1);assert.equal(stock.length,1);assert.equal(d.money,50);d.reset();assert.equal(d.money,0);assert.equal(d.ground.length,0);
}
console.log('Currency quantity, contact, full-stock pickup, repeated pickup, independent healing and reset passed');
