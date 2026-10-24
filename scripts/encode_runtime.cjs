// Lossless runtime encoding. Original assets remain in the local modeling archive.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const pnpm='F:/Projects/my-blog/node_modules/.pnpm';
function dep(prefix,name){return require(path.join(pnpm,fs.readdirSync(pnpm).filter(x=>x.startsWith(prefix)).sort().at(-1),'node_modules',name))}
const {NodeIO}=dep('@gltf-transform+core@','@gltf-transform/core');
const {ALL_EXTENSIONS,EXTMeshoptCompression,EXTTextureWebP}=dep('@gltf-transform+extensions@','@gltf-transform/extensions');
const {prune}=dep('@gltf-transform+functions@','@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder}=dep('meshoptimizer@1.','meshoptimizer'),sharp=dep('sharp@','sharp');
const root='assets/runtime-encoding',out='docs/evidence/assets/2026-10-24-runtime-encoding';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function restoreTransforms(original,target){
 const src=fs.readFileSync(original),dst=fs.readFileSync(target),source=JSON.parse(src.subarray(20,20+src.readUInt32LE(12))),json=JSON.parse(dst.subarray(20,20+dst.readUInt32LE(12)));
 const nodes=new Map(source.nodes.map(n=>[n.name,n]));assert.equal(nodes.size,source.nodes.length,'Source node names must be unique');
 for(const n of json.nodes){const old=nodes.get(n.name);assert(old,`Unknown node ${n.name}`);for(const k of ['translation','rotation','scale','matrix']){delete n[k];if(old[k]!==undefined)n[k]=old[k]}}
 const encoded=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
 const tail=dst.subarray(20+dst.readUInt32LE(12)),header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+tail.length,8);header.writeUInt32LE(padded.length,12);header.write('JSON',16);
 fs.writeFileSync(target,Buffer.concat([header,padded,tail]));
}
const raw=a=>{const v=a.getArray();return{type:a.getType(),component:a.getComponentType(),normalized:a.getNormalized(),count:a.getCount(),sha256:sha(Buffer.from(v.buffer,v.byteOffset,v.byteLength))}};
function indices(p){
 const a=p.getIndices();if(!a)return null;
 const v=a.getArray(),canonical=new Uint32Array(v.length);
 for(let i=0;i<v.length;i+=3){const j=v[i]<=v[i+1]&&v[i]<=v[i+2]?0:v[i+1]<=v[i+2]?1:2;for(let k=0;k<3;k++)canonical[i+k]=v[i+(j+k)%3]}
 return{count:a.getCount(),orientedTriangleHash:sha(Buffer.from(canonical.buffer))};
}
function semantic(doc){
 const r=doc.getRoot(),attribute=p=>Object.fromEntries(p.listSemantics().sort().map(k=>[k,raw(p.getAttribute(k))]));
 const bindings=m=>Object.fromEntries(['BaseColor','Normal','MetallicRoughness','Emissive','Occlusion'].map(k=>{
  const t=m[`get${k}Texture`](),i=m[`get${k}TextureInfo`]();
  return[k,t?{texture:r.listTextures().indexOf(t),coord:i.getTexCoord(),mag:i.getMagFilter(),min:i.getMinFilter(),s:i.getWrapS(),t:i.getWrapT()}:null];
 }));
 return{
  meshes:r.listMeshes().map(m=>({name:m.getName(),weights:m.getWeights(),primitives:m.listPrimitives().map(p=>({mode:p.getMode(),material:p.getMaterial()?.getName(),attributes:attribute(p),indices:indices(p),targets:p.listTargets().map(attribute)}))})),
  nodes:r.listNodes().map(n=>({name:n.getName(),matrix:n.getMatrix(),mesh:n.getMesh()?.getName(),skin:n.getSkin()?.getName(),children:n.listChildren().map(c=>c.getName())})),
  skins:r.listSkins().map(s=>({name:s.getName(),joints:s.listJoints().map(j=>j.getName()),matrices:raw(s.getInverseBindMatrices())})),
  animations:r.listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().map(c=>({node:c.getTargetNode()?.getName(),path:c.getTargetPath(),interpolation:c.getSampler().getInterpolation(),input:raw(c.getSampler().getInput()),output:raw(c.getSampler().getOutput())}))})),
  materials:r.listMaterials().map(m=>({name:m.getName(),base:m.getBaseColorFactor(),roughness:m.getRoughnessFactor(),metalness:m.getMetallicFactor(),emissive:m.getEmissiveFactor(),alpha:m.getAlphaMode(),cutoff:m.getAlphaCutoff(),doubleSided:m.getDoubleSided(),normal:m.getNormalScale(),bindings:bindings(m)})),
 };
}
async function pixels(t){const {data,info}=await sharp(t.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{width:info.width,height:info.height,channels:info.channels,rgbaHash:sha(data)}}
(async()=>{
 fs.mkdirSync(`${root}/before`,{recursive:true});fs.mkdirSync(`${root}/candidate`,{recursive:true});fs.mkdirSync(out,{recursive:true});
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder}),records=[];
 for(const name of ['raccoon','workshop','lookout','canoe-center-seat','canoe']){
  const original=`${root}/before/${name}.glb`;
  if(!fs.existsSync(original))fs.copyFileSync(`public/assets/models/${name}.glb`,original);
  const doc=await io.read(original);
  const sourceWorldMatrices=new Map(doc.getRoot().listNodes().map(n=>[n.getName(),n.getWorldMatrix()]));
  if(name==='canoe'){
   // Keep original paddle node hierarchy/transforms. Only discard unrelated meshes.
   for(const n of [...doc.getRoot().listNodes()])if(n.getMesh()&&!n.getName().startsWith('Paddle_'))n.setMesh(null);
   await doc.transform(prune({keepAttributes:true,keepIndices:true,keepLeaves:false}));
   assert.equal(doc.getRoot().listMeshes().length,2);
  }
  const before=semantic(doc),reference=await Promise.all(doc.getRoot().listTextures().map(pixels));
  const target=`${root}/candidate/${name==='canoe'?'paddle':name}.glb`;
  if(!process.argv.includes('--verify')){
  for(const t of doc.getRoot().listTextures())if(t.getMimeType()!=='image/webp'){
   const compressed=await sharp(t.getImage()).webp({lossless:true,effort:6}).toBuffer();
   const beforePixels=await sharp(t.getImage()).ensureAlpha().raw().toBuffer(),afterPixels=await sharp(compressed).ensureAlpha().raw().toBuffer();
   // Retain PNG if its invisible RGB channels would be altered as well.
   if(beforePixels.equals(afterPixels))t.setImage(compressed).setMimeType('image/webp');
  }
  doc.createExtension(EXTTextureWebP).setRequired(true);
  // QUANTIZE disables Meshopt's lossy filters. No quantize()/meshopt() transform is run.
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  await io.write(target,doc);
  restoreTransforms(original,target);
  }
  const decoded=await io.read(target),after=semantic(decoded),decodedPixels=await Promise.all(decoded.getRoot().listTextures().map(pixels));
  assert.deepEqual(after,before,`${name}: geometry, materials, rig, transforms or animations changed`);
  for(const n of decoded.getRoot().listNodes())assert.deepEqual(n.getWorldMatrix(),sourceWorldMatrices.get(n.getName()),`${name}: source world matrix changed`);
  assert.deepEqual(decodedPixels,reference,`${name}: decoded visible pixels changed`);
  const bytes=fs.readFileSync(target),source=fs.readFileSync(original);
  records.push({name,original,target,originalBytes:source.length,bytes:bytes.length,originalSha256:sha(source),sha256:sha(bytes),losslessSemantic:true,visiblePixelsExact:true,semanticHash:sha(JSON.stringify(after)),textures:reference,triangles:after.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+(p.indices?.count??0)/3,0),0),animationClips:after.animations.map(a=>a.name),decimated:false,quantized:false,textureResized:false});
  console.log(`${name}: ${source.length} -> ${bytes.length}`);
 }
 fs.writeFileSync(`${out}/encoding.json`,JSON.stringify(records,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
