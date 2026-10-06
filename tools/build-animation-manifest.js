const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const animationRoot=path.join(root,'design','enemies');
const output={enemies:{}};
for(const enemy of fs.readdirSync(animationRoot,{withFileTypes:true}).filter(entry=>entry.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
  for(const action of ['move','attack','special']){
    const folder=path.join(animationRoot,enemy.name,action);
    if(!fs.existsSync(folder))continue;
    const files=fs.readdirSync(folder,{withFileTypes:true})
      .filter(entry=>entry.isFile()&&/\d+\.png$/i.test(entry.name))
      .map(entry=>entry.name)
      .sort((a,b)=>Number(a.match(/(\d+)\.png$/i)[1])-Number(b.match(/(\d+)\.png$/i)[1])||a.localeCompare(b));
    if(!files.length)continue;
    output.enemies[enemy.name]??={move:[],attack:[],special:[]};
    output.enemies[enemy.name][action]=files.map(file=>path.posix.join('design/enemies',enemy.name,action,file));
    const distFolder=path.join(root,'dist','design','enemies',enemy.name,action);
    fs.mkdirSync(distFolder,{recursive:true});
    for(const file of files)fs.copyFileSync(path.join(folder,file),path.join(distFolder,file));
  }
}
const json=JSON.stringify(output,null,2)+'\n';
fs.writeFileSync(path.join(root,'animation-manifest.json'),json);
fs.writeFileSync(path.join(root,'dist','animation-manifest.json'),json);
console.log(`Generated animation-manifest.json (${Object.keys(output.enemies).length} enemies).`);
