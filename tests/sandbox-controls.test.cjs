const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const master=JSON.parse(fs.readFileSync('game-data.json','utf8'));
class Element{
 constructor(id=''){this.id=id;this.listeners={};this.children=[];this.options=this.children;this.value='';this.checked=true;this.disabled=false;this.textContent='';this.tagName='BUTTON'}
 addEventListener(k,fn){this.listeners[k]=fn}
 append(...items){this.children.push(...items);if(this.id==='enemySelect'&&!this.value)this.value=items[0].value}
 replaceChildren(){this.children.length=0}
 getContext(){return ctx}
 getBoundingClientRect(){return {left:0,top:0,width:640,height:480}}
 setPointerCapture(){}
}
const ctx=new Proxy({getImageData:()=>({data:[]})},{get:(o,k)=>o[k]||(()=>{})});
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
get('aiSelect').value='chase';let timer;
const c={console,performance:{now:()=>0},document:{getElementById:get,createElement:()=>new Element()},window:{addEventListener(){}},requestAnimationFrame(){},setTimeout:fn=>{timer=fn;return 1},clearTimeout(){timer=null},Image:class{set src(p){queueMicrotask(()=>this.onload())}},fetch:async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path,'utf8')),text:async()=>fs.readFileSync(path,'utf8')})};
vm.createContext(c);vm.runInContext(fs.readFileSync('attack-range.js','utf8'),c);c.AttackRange=c.window.AttackRange;vm.runInContext(fs.readFileSync('sandbox-engine.js','utf8'),c);c.SandboxAI=c.window.SandboxAI;
let source=fs.readFileSync('sandbox.js','utf8').replace(/\}\)\(\);\s*$/, 'globalThis.sandboxTest={snapshot:()=>({p,e,values,running}),step};})();');
(async()=>{
 await vm.runInContext(source,c);
 assert.equal(get('start').disabled,false,'読み込み後は開始可能');
 let s=c.sandboxTest.snapshot();assert.equal(s.p.hp,Math.min(500,master.general.start_energy));
 const pointer={clientX:220,clientY:240,pointerId:1};get('arena').listeners.pointerdown(pointer);assert.ok(timer,'停止中のキャラクター長押しを予約');timer();get('arena').listeners.pointermove({...pointer,clientX:100,clientY:90});get('arena').listeners.pointerup();
 s=c.sandboxTest.snapshot();assert.equal(s.p.x,100);assert.equal(s.p.y,90,'長押し後は配置を変更できる');
 get('enemySelect').value='slime_red';await get('enemySelect').listeners.change();s=c.sandboxTest.snapshot();assert.equal(s.e.hp,master.enemies.slime_red.hp);assert.equal(s.values.eatk,master.enemies.slime_red.attack,'攻撃力はHPでなくattackを参照');
 s.e.x=s.p.x+35;s.e.y=s.p.y;get('start').listeners.click();const hp=s.e.hp;get('attack').listeners.click();assert.equal(s.e.hp,hp-s.values.patk,'通常攻撃が敵HPを減らす');
 get('arena').listeners.pointerdown({clientX:500,clientY:240,pointerId:2});c.sandboxTest.step(.1);assert.ok(s.p.x>220,'開始後のタップ指定でプレイヤーが移動');get('arena').listeners.pointerup();
 get('reset').listeners.click();s=c.sandboxTest.snapshot();assert.equal(s.running,false);assert.equal(s.p.x,220);assert.equal(s.e.hp,s.values.ehp);
 console.log('sandbox controls: passed');
})().catch(error=>{console.error(error);process.exitCode=1});
