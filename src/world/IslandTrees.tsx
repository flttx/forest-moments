import {Suspense,useEffect,useMemo,useRef} from 'react'
import {useGLTF} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {vegetationPositions} from './vegetationLayout'
import type {PlantKit} from './vegetationLayout'
import {terrainHeight} from './terrain'
import {transformedGeometry} from './transformedGeometry'
import {patchFoliageMaterial} from './foliageMaterial'
import {climateUniforms} from './climateUniforms'
import {patchAutumnTreeMaterial} from './autumnTreeMaterial'
import {useUiStore} from '../game/uiStore'

// Young forms keep the source height mapping below the crown base: uniform scale × bole shortening (derive_young_trees.py).
const broadleafKits={'ie-birch':{kind:'birch',heightScale:1},'ie-maple':{kind:'maple',heightScale:1},'ie-young-birch':{kind:'birch',heightScale:4/6.5*.8},'ie-young-maple':{kind:'maple',heightScale:3.7/6*.85}} as const
type TreeKits=readonly (readonly [PlantKit,string])[]
const adultKits:TreeKits=[['ie-old-pine','old-pine'],['ie-spruce','spruce'],['ie-spruce-sapling','spruce-sapling'],['ie-birch','birch'],['ie-maple','maple'],['ie-windswept-pine','windswept-pine'],['ie-windswept-pine-b','windswept-pine-b'],['ie-alder','alder']]
// Young forms stand far from the spawn (west forest, Autumn Isle). Measured 2026-11-04 they added ~6.5 s to a cold load,
// so they download after the loading card; their trunk solids and camera crowns come from layout data and exist at once.
const youngKits:TreeKits=[['ie-young-pine','young-pine'],['ie-young-birch','young-birch'],['ie-young-maple','young-maple']]

/**
 * AHOLO trees, instanced in small chunks. Near chunks draw the full model; past ~30 m a chunk swaps to a collapse-decimated
 * copy (derive_tree_lods.py, ~12% of the faces) with the same material. Measured 2026-11-05: the full trees were 16.7 M of
 * 22.7 M scene triangles and half the frame time, though most stand far from the camera at any moment.
 */
function TreeField({kits,name}:{kits:TreeKits;name:string}){
 const gltfs=useGLTF(kits.map(([,file])=>`./assets/island-trees/${file}.glb`))
 const lods=useGLTF(kits.map(([,file])=>`./assets/island-trees/${file}-lod.glb`))
 const field=useMemo(()=>{
  const root=new THREE.Group();root.name=name
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[]
  const dummy=new THREE.Object3D()
  const chunks:{hi:THREE.Group;lo:THREE.InstancedMesh;center:THREE.Vector3;far:boolean}[]=[]
  let saplingTriangles=0
  kits.forEach(([kit],k)=>{
   const items=vegetationPositions.filter(p=>p.kit===kit),groups=new Map<string,typeof items>()
   for(const p of items){const key=`${Math.floor(p.x/8)},${Math.floor(p.z/8)}`;groups.set(key,[...(groups.get(key)??[]),p])}
   const source=(scene:THREE.Group)=>{
    scene.updateMatrixWorld(true)
    const parts:{geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]}[]=[]
    scene.traverse(o=>{
     if(!(o instanceof THREE.Mesh))return
     const geometry=transformedGeometry(o.geometry,o.matrixWorld);geometries.push(geometry)
     const clone=(m:THREE.Material)=>{const copy=m.clone();const broadleaf=broadleafKits[kit as keyof typeof broadleafKits];if(broadleaf)patchAutumnTreeMaterial(copy,broadleaf.kind,broadleaf.heightScale);else if(kit==='ie-alder')patchFoliageMaterial(copy);else patchFoliageMaterial(copy,climateUniforms.climatePine);materials.push(copy);return copy}
     parts.push({geometry,material:Array.isArray(o.material)?o.material.map(clone):clone(o.material)})
    })
    return parts
   }
   const highParts=source(gltfs[k].scene)
   if(kit==='ie-spruce-sapling')saplingTriangles=highParts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.getAttribute('position').count)/3,0)
   let lodGeometry:THREE.BufferGeometry|undefined
   lods[k].scene.updateMatrixWorld(true)
   lods[k].scene.traverse(o=>{if(!lodGeometry&&o instanceof THREE.Mesh){lodGeometry=transformedGeometry(o.geometry,o.matrixWorld);geometries.push(lodGeometry)}})
   if(!lodGeometry)throw Error(`No LOD mesh for ${kit}`)
   const place=(mesh:THREE.InstancedMesh,plants:typeof items)=>{
    plants.forEach((p,i)=>{dummy.position.set(p.x,terrainHeight(p.x,p.z),p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)})
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true
   }
   for(const [key,plants] of groups){
     const group=new THREE.Group();group.name=`${kit}-${key}`
     for(const part of highParts){const mesh=new THREE.InstancedMesh(part.geometry,part.material,plants.length);place(mesh,plants);group.add(mesh)}
     const lo=new THREE.InstancedMesh(lodGeometry,highParts[0].material,plants.length);lo.name=`lod-${kit}-${key}`;place(lo,plants);lo.visible=false
     root.add(group,lo);chunks.push({hi:group,lo,center:lo.boundingSphere!.center.clone(),far:false})
   }
  })
  root.userData.qa={saplings:vegetationPositions.filter(p=>p.kit==='ie-spruce-sapling').length,saplingTriangles,instances:vegetationPositions.filter(p=>kits.some(([kit])=>kit===p.kit)).length}
  return{root,geometries,materials,chunks}
 },[kits,name,gltfs,lods])
 useEffect(()=>()=>{field.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()});field.geometries.forEach(g=>g.dispose());field.materials.forEach(m=>m.dispose())},[field])
 const runtime=useRef(field)
 // Same band as the forest kit: swap out past 31 m, back in under 27 m, so a chunk at the edge does not flicker.
 useFrame(({camera})=>{const current=runtime.current;for(const c of current.chunks){const d=c.center.distanceTo(camera.position);c.far=c.far?d>27:d>31;c.hi.visible=!c.far;c.lo.visible=c.far}})
 return <primitive object={field.root} dispose={null}/>
}

export function IslandTrees(){
 const loaded=useUiStore(s=>s.loadingDone)
 return <>
  <TreeField kits={adultKits} name="aholo-island-trees"/>
  {loaded&&<Suspense fallback={null}><TreeField kits={youngKits} name="aholo-young-trees"/></Suspense>}
 </>
}
