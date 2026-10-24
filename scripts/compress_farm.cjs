// Reuse local, previously generated farm assets; source files remain read-only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pnpm='F:/Projects/my-blog/node_modules/.pnpm';
function dep(prefix,name){return require(path.join(pnpm,fs.readdirSync(pnpm).filter(x=>x.startsWith(prefix)).sort().at(-1),'node_modules',name))}
const {NodeIO}=dep('@gltf-transform+core@','@gltf-transform/core'),{ALL_EXTENSIONS}=dep('@gltf-transform+extensions@','@gltf-transform/extensions'),{meshopt,textureCompress}=dep('@gltf-transform+functions@','@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder}=dep('meshoptimizer@1.','meshoptimizer'),sharp=dep('sharp@','sharp');
(async()=>{
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
 const records=[];
 for(const name of ['hen','sheep','ranch']){
  const source=name==='ranch'?'assets/farm/ranch-grounded.glb':`F:/Projects/my-blog/public/assets/world/farm/animal-${name}.glb`,output=`public/assets/models/farm-${name}.glb`;
  const doc=await io.read(source),count=()=>doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0),before=count();
  if(name==='ranch'){await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:90,resize:[1024,1024]}),meshopt({encoder:MeshoptEncoder,level:'high'}));await io.write(output,doc)}else fs.copyFileSync(source,output);
  if(count()!==before)throw Error('Topology changed');
  const bytes=fs.readFileSync(output);records.push({name,source,output,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles:count(),animations:doc.getRoot().listAnimations().map(a=>a.getName()),bones:doc.getRoot().listSkins().map(s=>s.listJoints().length),textures:doc.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),newGeneration:false});
 }
 fs.writeFileSync('docs/evidence/assets/2026-10-24-farm/runtime-assets.json',JSON.stringify(records,null,2)+'\n');console.log(JSON.stringify(records));
})().catch(e=>{console.error(e);process.exitCode=1});
