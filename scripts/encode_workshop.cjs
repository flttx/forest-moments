const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base='F:/Projects/my-blog/node_modules/.pnpm';
const dep=(p,n)=>require(path.join(base,fs.readdirSync(base).filter(x=>x.startsWith(p)).sort().at(-1),'node_modules',n));
const {NodeIO}=dep('@gltf-transform+core@','@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression,EXTTextureWebP}=dep('@gltf-transform+extensions@','@gltf-transform/extensions'),{MeshoptEncoder,MeshoptDecoder}=dep('meshoptimizer@1.','meshoptimizer'),sharp=dep('sharp@','sharp');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder}),records=[];
for(const kind of ['workbench','stool']){
 const source=`assets/workshop/${kind}.glb`,output=`assets/workshop/rejected-outdoor-runtime/craft-${kind}.glb`,doc=await io.read(source);
 const signatures=d=>d.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>({count:p.getIndices().getCount(),attrs:Object.fromEntries(p.listSemantics().map(k=>{const a=p.getAttribute(k).getArray();return[k,sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]}))})));
 const before=signatures(doc);
 for(const t of doc.getRoot().listTextures()){const image=t.getImage(),next=await sharp(image).webp({lossless:true,effort:6}).toBuffer();if((await sharp(image).ensureAlpha().raw().toBuffer()).equals(await sharp(next).ensureAlpha().raw().toBuffer()))t.setImage(next).setMimeType('image/webp')}
 doc.createExtension(EXTTextureWebP).setRequired(true);doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});await io.write(output,doc);
 require('node:assert/strict').deepEqual(signatures(await io.read(output)),before);
 records.push({kind,source,output,bytes:fs.statSync(output).size,sha256:sha(fs.readFileSync(output)),sourceSha256:sha(fs.readFileSync(source)),triangles:before.reduce((n,p)=>n+p.count/3,0),textures:doc.getRoot().listTextures().map(t=>({size:t.getSize(),mime:t.getMimeType()})),newGeneration:false,decimated:false});
}
fs.writeFileSync('docs/evidence/2026-10-24-workshop/runtime-assets.json',JSON.stringify(records,null,2)+'\n');console.log(records);
})().catch(e=>{console.error(e);process.exitCode=1});
