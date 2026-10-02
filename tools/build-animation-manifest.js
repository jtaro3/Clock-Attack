const fs=require('node:fs');
const path=require('node:path');

const root=process.cwd();
const animationRoot=path.join(root,'design','Animation','enemies');
const output={enemies:{}};
for(const action of ['move','attack']){
  const folder=path.join(animationRoot,action);
  if(!fs.existsSync(folder))continue;
  const files=fs.readdirSync(folder,{withFileTypes:true})
    .filter(entry=>entry.isFile()&&/^slime_blue_\d+\.png$/i.test(entry.name))
    .map(entry=>entry.name)
    .sort((a,b)=>Number(a.match(/_(\d+)\.png$/i)[1])-Number(b.match(/_(\d+)\.png$/i)[1]));
  if(files.length)output.enemies.slime_blue??={};
  if(files.length)output.enemies.slime_blue[action]=files.map(file=>path.posix.join('design/Animation/enemies',action,file));
  const distFolder=path.join(root,'dist','design','Animation','enemies',action);
  fs.mkdirSync(distFolder,{recursive:true});
  for(const file of files)fs.copyFileSync(path.join(folder,file),path.join(distFolder,file));
}
const json=JSON.stringify(output,null,2)+'\n';
fs.writeFileSync(path.join(root,'animation-manifest.json'),json);
fs.writeFileSync(path.join(root,'dist','animation-manifest.json'),json);
console.log(`Generated animation-manifest.json (${output.enemies.slime_blue?.move?.length||0} move, ${output.enemies.slime_blue?.attack?.length||0} attack frames).`);
