// Read-only my-blog inputs. Run: node scripts/extract_vegetation.cjs [source-root]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = path.resolve(process.argv[2] || 'F:/Projects/my-blog');
const pnpm = path.join(source, 'node_modules/.pnpm');
function dependency(prefix, name) {
  const folder = fs.readdirSync(pnpm).filter(x => x.startsWith(prefix)).sort().at(-1);
  return require(path.join(pnpm, folder, 'node_modules', name));
}
const { NodeIO } = dependency('@gltf-transform+core@', '@gltf-transform/core');
const { ALL_EXTENSIONS } = dependency('@gltf-transform+extensions@', '@gltf-transform/extensions');
const { prune } = dependency('@gltf-transform+functions@', '@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder } = dependency('meshoptimizer@1.', 'meshoptimizer');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const evidence = 'docs/evidence/vegetation-expansion/2026-10-24';
const out = 'public/assets/vegetation';
const archive = 'assets/vegetation';
for (const dir of [evidence, out, archive]) fs.mkdirSync(dir, {recursive:true});
const kits = ['tall-pine-a','normal-pine-b','round-tree-a','young-tree-b','bush-a','lantern'];
function glbJSON(file) {const b=fs.readFileSync(file);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));}
const original = glbJSON(path.join(source,'assets/blender/world-v3/derived/forest-island-ecology-v3.glb'));
const lodReport = readJSON(path.join(source,'assets/blender/world-v3/derived/ecology-lod-build.json'));
const manifests = [1,2].flatMap(n => readJSON(path.join(source,`assets/blender/environment-kit/environment-kit-batch${n}-manifest.json`)).assets);
function templateFrame(kit) {
  if (lodReport.kits['Eco_'+kit]) {
    const r=lodReport.kits['Eco_'+kit];return {center:r.gltf_centre,half:r.gltf_half_extent};
  }
  const n=original.nodes.find(n=>n.name==='Eco_'+kit);
  const p=original.meshes[n.mesh].primitives[0];
  const a=original.accessors[p.attributes.POSITION];
  return {center:a.min.map((v,i)=>(v+a.max[i])/2),half:Math.max(...a.min.map((v,i)=>a.max[i]-v))/2};
}
(async()=>{
 await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
 const report={date:'2026-10-24',sourceRoot:source,sourceCommit:require('node:child_process').execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),authorization:'User authorized local reuse; commercial license not independently confirmed. No generation or paid calls.',files:[],templates:{}};
 for(const [input,output,lod] of [['forest-island-ecology-v3.glb','forest-kit.glb',false],['ecology-lod.glb','forest-kit-lod.glb',true]]) {
  const file=path.join(source,'public/assets/world/ecology',input);const bytes=fs.readFileSync(file);
  fs.writeFileSync(path.join(archive,'source-'+input),bytes);
  const doc=await io.read(file);const root=doc.getRoot();const retained=[];
  for(const node of root.listNodes()) {
   const kit=node.getName().replace(/^(LOD_)?Eco_/,'');
   if(!kits.includes(kit)) {node.dispose();continue;}
   const frame=templateFrame(kit);
   const offset=lod?node.getTranslation():[0,0,0],scale=lod?node.getScale():[1,1,1];
   node.setTranslation(frame.center.map((v,i)=>v+frame.half*offset[i]));
   node.setScale(scale.map(v=>v*frame.half));node.setRotation([0,0,0,1]);
   node.setExtension('EXT_mesh_gpu_instancing',null);
   const extras=node.getExtras();delete extras.instance_labels;node.setExtras(extras);
   retained.push(node);
   if(!lod) {
    const entry=manifests.find(x=>x.asset_id.endsWith(kit) || (kit==='bush-a' && x.asset_id==='environment-kit-bush-a-v2'));
    report.templates[kit]={frame,colliders:extras.collider_circles,triangles:node.getMesh().listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0),sourceTask:entry?.source_task_id,sourceProduction:entry?.production_glb,attributes:node.getMesh().listPrimitives().map(p=>Object.fromEntries(p.listSemantics().map(s=>[s,hash(Buffer.from(p.getAttribute(s).getArray().buffer))])))};
   }
  }
  for(const e of root.listExtensionsUsed()) if(e.extensionName==='EXT_mesh_gpu_instancing')e.dispose();
  await doc.transform(prune());
  await io.write(path.join(out,output),doc);
  const written=fs.readFileSync(path.join(out,output));fs.writeFileSync(path.join(archive,output),written);
  const reread=await io.read(path.join(out,output));
  for(const node of reread.getRoot().listNodes()) {
   const match=retained.find(x=>x.getName()===node.getName());
   const a=match.getMesh().listPrimitives(),b=node.getMesh().listPrimitives();
   a.forEach((p,i)=>p.listSemantics().forEach(s=>{if(!Buffer.from(p.getAttribute(s).getArray().buffer).equals(Buffer.from(b[i].getAttribute(s).getArray().buffer)))throw Error('Changed attribute '+node.getName()+s)}));
  }
  for(const ext of doc.getRoot().listExtensionsUsed()) if(ext.extensionName==='EXT_meshopt_compression') ext.dispose();
  await io.write(path.join(archive,output.replace('.glb','-review.glb')),doc);
  report.files.push({source:file,sourceBytes:bytes.length,sourceSHA256:hash(bytes),output:path.join(out,output),bytes:written.length,sha256:hash(written),decodedAttributesPreserved:true,textures:root.listTextures().map(t=>({name:t.getName(),size:t.getSize(),bytes:t.getImage().length,sha256:hash(t.getImage())}))});
 }
 const glow=path.join(source,'public/assets/world/ecology/lantern-glow.webp');const bytes=fs.readFileSync(glow);
 for(const dir of [out,archive])fs.writeFileSync(path.join(dir,'lantern-glow.webp'),bytes);
 report.files.push({source:glow,output:out+'/lantern-glow.webp',bytes:bytes.length,sha256:hash(bytes),sourceSHA256:hash(bytes)});
 report.totalBytes=report.files.reduce((n,f)=>n+f.bytes,0);
 fs.writeFileSync(evidence+'/asset-manifest.json',JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync('src/world/vegetation-templates.json',JSON.stringify(Object.fromEntries(Object.entries(report.templates).map(([k,v])=>[k,{frame:v.frame,colliders:v.colliders}])),null,2)+'\n');
 console.log(JSON.stringify({totalBytes:report.totalBytes,templates:report.templates},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
