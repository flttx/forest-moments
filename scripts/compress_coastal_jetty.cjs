// Preserve every triangle; use Meshopt packing and WebP textures for browser delivery.
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
 const doc=await io.read('assets/lux3d/coastal-jetty-v1/runtime-uncompressed.glb');
 const count=()=>doc.getRoot().listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0),0);
 const before=count();
 await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:92,resize:[2048,2048]}),meshopt({encoder:MeshoptEncoder,level:'high'}));
 if(count()!==before)throw Error('Unexpected topology count change');
 const output='public/assets/models/coastal-jetty.glb';await io.write(output,doc);
 const bytes=fs.readFileSync(output);
 fs.copyFileSync(output,'assets/lux3d/coastal-jetty-v1/runtime.glb');
 const report={output,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles:count(),decimated:false,textureQuality:92,textures:doc.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType(),bytes:t.getImage().length}))};
 fs.writeFileSync('docs/evidence/assets/2026-10-24-coastal-layout/runtime-asset.json',JSON.stringify(report,null,2)+'\n');console.log(report);
})().catch(e=>{console.error(e);process.exitCode=1});
