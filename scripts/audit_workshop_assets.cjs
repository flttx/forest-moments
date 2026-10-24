const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base='F:/Projects/my-blog/node_modules/.pnpm';
const dep=(p,n)=>require(path.join(base,fs.readdirSync(base).filter(x=>x.startsWith(p)).sort().at(-1),'node_modules',n));
const {NodeIO}=dep('@gltf-transform+core@','@gltf-transform/core'),{ALL_EXTENSIONS}=dep('@gltf-transform+extensions@','@gltf-transform/extensions'),{MeshoptDecoder}=dep('meshoptimizer@1.','meshoptimizer');
(async()=>{
 await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const doc=await io.read('public/assets/interiors/workshop.glb');
 const files=fs.readdirSync('public/assets/interiors').map(name=>{const p=`public/assets/interiors/${name}`,source=`F:/Projects/my-blog/public/assets/world/interiors/${name}`,bytes=fs.readFileSync(p);assert(bytes.equals(fs.readFileSync(source)));return{path:p,source,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
 const report={source:'Historical my-blog Tripo props + Blender authored room; original files reused unchanged',newGeneration:false,newCharges:false,files,totalBytes:files.reduce((s,f)=>s+f.bytes,0),meshes:doc.getRoot().listMeshes().map(m=>({name:m.getName(),triangles:m.listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0)})),textures:doc.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),historicalTasks:doc.getRoot().listMaterials().filter(m=>m.getName().startsWith('tripo_material_')).map(m=>m.getName().replace('tripo_material_','')),sourceBlender:'F:/Projects/my-blog/assets/blender/interiors/derived/workshop-interior.blend',colliderExport:'src/game/workshopColliders.json'};
 fs.writeFileSync('docs/evidence/2026-10-24-workshop/interior-assets.json',JSON.stringify(report,null,2)+'\n');console.log({totalBytes:report.totalBytes,meshes:report.meshes.length,textures:report.textures.length});
})().catch(e=>{console.error(e);process.exitCode=1});
