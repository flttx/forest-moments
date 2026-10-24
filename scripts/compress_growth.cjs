// Preserve AHOLO topology, encode textures and buffers for the browser.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pnpm='F:/Projects/my-blog/node_modules/.pnpm';
function dependency(prefix,name){return require(path.join(pnpm,fs.readdirSync(pnpm).filter(x=>x.startsWith(prefix)).sort().at(-1),'node_modules',name))}
const {NodeIO}=dependency('@gltf-transform+core@','@gltf-transform/core');
const {ALL_EXTENSIONS}=dependency('@gltf-transform+extensions@','@gltf-transform/extensions');
const {meshopt,textureCompress}=dependency('@gltf-transform+functions@','@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder}=dependency('meshoptimizer@1.','meshoptimizer');
const sharp=dependency('sharp@','sharp');
(async()=>{
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
 const records=[];
 for(const stage of ['sprout','seedling','young','mature']){
  const doc=await io.read(`assets/lux3d/growth-${stage}-v1/runtime-uncompressed.glb`);
  const count=()=>doc.getRoot().listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0),0);
  const before=count();await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:92,resize:[1024,1024]}),meshopt({encoder:MeshoptEncoder,level:'high'}));
  if(count()!==before)throw Error('Topology count changed');
  const output=`public/assets/models/tree-${stage}.glb`;await io.write(output,doc);
  const bytes=fs.readFileSync(output);records.push({stage,output,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles:count(),decimated:false,textureQuality:92,textures:doc.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()}))});
 }
 fs.writeFileSync('docs/evidence/assets/2026-10-24-tree-growth/runtime-assets.json',JSON.stringify(records,null,2)+'\n');console.log(JSON.stringify(records));
})().catch(e=>{console.error(e.message);process.exitCode=1});
