const fs=require('node:fs'),path=require('node:path');
const base='F:/Projects/my-blog/node_modules/.pnpm';
const dep=(p,n)=>require(path.join(base,fs.readdirSync(base).filter(x=>x.startsWith(p)).sort().at(-1),'node_modules',n));
const {NodeIO}=dep('@gltf-transform+core@','@gltf-transform/core'),{ALL_EXTENSIONS}=dep('@gltf-transform+extensions@','@gltf-transform/extensions'),{MeshoptDecoder}=dep('meshoptimizer@1.','meshoptimizer'),T=require('three');
(async()=>{await MeshoptDecoder.ready;const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read('public/assets/models/lookout.glb');const group=new T.Group();
for(const n of doc.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p.getAttribute('POSITION').getArray(),3));if(p.getIndices())g.setIndex(new T.BufferAttribute(p.getIndices().getArray(),1));g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));g.translate(0,3,0);g.scale(6.8/6,6.8/6,6.8/6);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=n.getName();group.add(mesh)}group.updateMatrixWorld(true);
const ray=new T.Raycaster(new T.Vector3(0,4.9,0),new T.Vector3(0,-1,0));
const deck=ray.intersectObject(group)[0];ray.set(new T.Vector3(0,4.9,0),new T.Vector3(0,1,0));const roof=ray.intersectObject(group)[0];
const point=new T.Vector3(0,4.9,0),triangle=new T.Triangle(),nearest=new T.Vector3();let clearance=Infinity;
for(const mesh of group.children){const a=mesh.geometry.attributes.position,i=mesh.geometry.index;for(let k=0;k<i.count;k+=3){triangle.a.fromBufferAttribute(a,i.getX(k));triangle.b.fromBufferAttribute(a,i.getX(k+1));triangle.c.fromBufferAttribute(a,i.getX(k+2));triangle.closestPointToPoint(point,nearest);clearance=Math.min(clearance,point.distanceTo(nearest))}}
if(!deck||Math.abs(deck.point.y-3.638)>.01||!roof||clearance<.15)throw Error('Unsafe lookout eye');
const result={status:'PASS',asset:'public/assets/models/lookout.glb',sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync('public/assets/models/lookout.glb')).digest('hex'),eye:[13,4.9,-8],deckY:deck.point.y,roofUndersideY:roof.point.y,nearestTriangleDistance:clearance,newModel:false};
fs.mkdirSync('docs/evidence/2026-10-24-lookout',{recursive:true});fs.writeFileSync('docs/evidence/2026-10-24-lookout/geometry.json',JSON.stringify(result,null,2)+'\n');console.log(result);
})();
