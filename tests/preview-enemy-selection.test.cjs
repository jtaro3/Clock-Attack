const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ClockAttackAssets=require('../asset-paths.js');
class Element{
  constructor(){this.children=[];this.listeners={};this.dataset={};this.value='';this.checked=false;this.hidden=false;this.classList={add(){},remove(){},contains:()=>true,toggle(){}};}
  addEventListener(name,fn){this.listeners[name]=fn}
  emit(name){return this.listeners[name]?.({target:this})}
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=children}
  querySelectorAll(){return this.children}
  closest(){return this}
  getBoundingClientRect(){return {width:760,height:600}}
  getContext(){return context}
  removeAttribute(){}
}
const drawn=[];
const context=new Proxy({getImageData:()=>({data:[]}),fillText:text=>drawn.push(text)},{get:(o,k)=>o[k]||(()=>{})});
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
const categories=['enemy','player'].map(category=>{const b=new Element();b.dataset.category=category;return b});
const stored=new Map(),pendingGreen=[];
let copied='',master={enemies:{slime_blue:{move_speed_px_per_second:27},slime_green:{move_speed_px_per_second:11,animation_move_frame_seconds:[.2,.3],animation_attack_frame_seconds:[.4]},slime_red:{move_speed_px_per_second:15}}};
const manifest={enemies:{slime_blue:{move:['blue1.png'],attack:['blueAttack.png']},slime_green:{move:['green1.png','green2.png'],attack:['greenAttack.png']},slime_red:{move:['red1.png'],attack:[]}}};
const c={document:{getElementById:get,querySelectorAll:s=>s==='[data-category]'?categories:[],createElement:()=>new Element()},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},navigator:{clipboard:{writeText:async text=>{copied=text}}},performance:{now:()=>1000},devicePixelRatio:1,ResizeObserver:class{observe(){}},requestAnimationFrame(){},fetch:async file=>({ok:true,json:async()=>file==='animation-manifest.json'?manifest:master}),Image:class{set src(file){if(file.includes('green'))pendingGreen.push(()=>this.onload());else queueMicrotask(()=>this.onload())}},console};
c.ClockAttackAssets=ClockAttackAssets;vm.createContext(c);
let source=fs.readFileSync('animation-preview.js','utf8');
source=source.replace(/\}\)\(\);\s*$/,`globalThis.preview={selectEnemy,snapshot:()=>({enemyKey,tuning,move:enemyMoveImages.map(i=>i.label),attack:enemyAttackImages.map(i=>i.label)}),setCanvasSize};})();`);
vm.runInContext(source,c);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await flush();await flush();
  assert.deepEqual(get('enemySelect').children.map(o=>o.value),['slime_blue','slime_green','slime_red']);
  assert.equal(c.preview.snapshot().enemyKey,'slime_blue');
  get('enemySearch').value='  GREEN  ';get('enemySearch').emit('input');
  assert.deepEqual(get('enemySelect').children.filter(o=>o.value).map(o=>o.value),['slime_green']);
  assert.equal(get('enemySelect').value,'');assert.equal(c.preview.snapshot().enemyKey,'slime_blue');
  get('enemySearch').value='missing';get('enemySearch').emit('input');
  assert.equal(get('enemySelect').disabled,true);assert.equal(get('enemySearchStatus').textContent,'0件');
  get('enemySearch').value='slime blue';get('enemySearch').emit('input');
  assert.equal(get('enemySelect').value,'slime_blue');assert.equal(get('enemySelect').disabled,false);
  get('enemySearch').value='';get('enemySearch').emit('input');assert.equal(get('enemySelect').children.length,3);
  categories[0].emit('click');assert.equal(get('enemyPicker').hidden,false);
  get('subChoices').children[0].emit('click');
  get('enemySearch').value='green';get('enemySearch').emit('input');get('enemySelect').value='slime_green';
  const green=get('enemySelect').emit('change');await flush();pendingGreen.splice(0).forEach(resolve=>resolve());await green;await flush();
  assert.equal(c.preview.snapshot().tuning.moveSpeed,11);
  assert.equal(c.preview.snapshot().move.length,2);assert.equal(get('moveSettings').children.length,2);
  get('moveSpeed').value='22';get('moveSpeed').emit('input');
  await get('copySettings').emit('click');assert.equal(JSON.parse(copied).enemy_key,'slime_green');assert.equal(JSON.parse(copied).move_speed_px_per_second,22);
  await c.preview.selectEnemy('slime_blue');assert.equal(c.preview.snapshot().tuning.moveSpeed,27);
  const greenAgain=c.preview.selectEnemy('slime_green');pendingGreen.splice(0).forEach(resolve=>resolve());await greenAgain;assert.equal(c.preview.snapshot().tuning.moveSpeed,22);
  master.enemies.slime_green.move_speed_px_per_second=13;await get('loadDataSettings').emit('click');assert.equal(c.preview.snapshot().tuning.moveSpeed,13);
  const slowGreen=c.preview.selectEnemy('slime_green');await c.preview.selectEnemy('slime_red');pendingGreen.splice(0).forEach(resolve=>resolve());await slowGreen;
  assert.equal(c.preview.snapshot().enemyKey,'slime_red');assert.equal(c.preview.snapshot().move[0],'red1.png');
  get('subChoices').children[1].emit('click');c.preview.setCanvasSize();assert(drawn.some(text=>text.includes('slime_redの攻撃画像は未配置')));
  categories[1].emit('click');assert.equal(get('enemyPicker').hidden,true);
  console.log('Manifest selection, per-enemy master/storage/copy, rapid switching, and missing-action preview passed');
})().catch(error=>{console.error(error);process.exitCode=1});
