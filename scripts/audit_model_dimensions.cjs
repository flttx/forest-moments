const fs=require('node:fs'),path=require('node:path'),T=require('three');
const deps='F:/Projects/my-blog/node_modules/.pnpm',dep=(prefix,name)=>require(path.join(deps,fs.readdirSync(deps).filter(n=>n.startsWith(prefix)).sort().at(-1),'node_modules',name));
const {NodeIO}=dep('@gltf-transform+core@','@gltf-transform/core'),{ALL_EXTENSIONS}=dep('@gltf-transform+extensions@','@gltf-transform/extensions'),{MeshoptDecoder}=dep('meshoptimizer@1.','meshoptimizer');
(async()=>{await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});const report=[];
for(const folder of ['public/assets/models','public/assets/interiors','public/assets/vegetation'])for(const file of fs.readdirSync(folder).filter(s=>s.endsWith('.glb'))){
 const name=folder+'/'+file,doc=await io.read(name),all=new T.Box3(),parts=[];
 for(const node of doc.getRoot().listNodes())if(node.getMesh()){
  const box=new T.Box3(),matrix=new T.Matrix4().fromArray(node.getWorldMatrix()),v=new T.Vector3();
  for(const p of node.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++){const e=a.getElement(i,[]);v.fromArray(e).applyMatrix4(matrix);box.expandByPoint(v)}}
  if(!node.getName().startsWith('Collider_')&&node.getName()!=='Floor_Walk')all.union(box);
  parts.push({name:node.getName(),min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new T.Vector3()).toArray()});
 }
 const record={file:name,min:all.min.toArray(),max:all.max.toArray(),size:all.getSize(new T.Vector3()).toArray(),parts};report.push(record);console.log(file,record.size.map(n=>n.toFixed(3)).join(' x '));
 if(folder.endsWith('interiors')||folder.endsWith('vegetation'))console.log(parts.filter(p=>!p.name.startsWith('Collider_')).map(p=>[p.name,p.size.map(n=>n.toFixed(3)).join(' x ')]));
}
fs.writeFileSync('docs/evidence/2026-10-24-scale/source-dimensions.json',JSON.stringify({note:'Decoded glTF node transforms; unposed source geometry, not animated runtime skin bounds',assets:report},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
