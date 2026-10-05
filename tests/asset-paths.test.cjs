const assert=require('node:assert/strict'),fs=require('node:fs');
const assets=require('../asset-paths.js');
const custom=assets.create([{asset_key:'hero',asset_type:'player',owner_key:'player',direction:'front',sprite_file:'custom hero.png'},{asset_key:'sand_blue',asset_type:'items',sprite_file:'custom.svg'},{asset_key:'off',asset_type:'items',sprite_file:'off.svg',enabled:'0'}]);
assert.equal(custom.playerFiles()[4],'design/player/custom%20hero.png');
assert.equal(custom.playerFiles()[0],null);assert.equal(custom.itemPath('sand_blue'),'design/items/custom.svg');assert.equal(custom.itemPath('off'),null);
assert.equal(assets.path({asset_type:'items',sprite_file:'../outside.svg'}),null);
for(const prefix of ['','dist/']){
  const data=JSON.parse(fs.readFileSync(prefix+'game-data.json','utf8')),registry=assets.create(data.assets);
  for(const path of registry.playerFiles()){assert(path);assert(fs.existsSync(prefix+decodeURIComponent(path)),path)}
  assert.equal(registry.itemPath('sand_blue'),'design/items/bottle_blue.svg');assert(fs.existsSync(prefix+registry.itemPath('sand_blue')));
  assert(!fs.existsSync(prefix+'design/man1.png'));
}
console.log('Master-driven custom filenames, directions, item folders, and root/dist files passed');
