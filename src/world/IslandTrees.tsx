import {Suspense,useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
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

/** Full-detail AHOLO trees, instanced in small chunks. Simplification requires measured need and visual review. */
function TreeField({kits,name}:{kits:TreeKits;name:string}){
 const gltfs=useGLTF(kits.map(([,file])=>`./assets/island-trees/${file}.glb`))
 const field=useMemo(()=>{
  const root=new THREE.Group();root.name=name
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[]
  const dummy=new THREE.Object3D()
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
   for(const [key,plants] of groups){
     const group=new THREE.Group();group.name=`${kit}-${key}`
     for(const part of highParts){
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,plants.length)
      plants.forEach((p,i)=>{dummy.position.set(p.x,terrainHeight(p.x,p.z),p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)})
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)
     }
     root.add(group)
   }
  })
  root.userData.qa={saplings:vegetationPositions.filter(p=>p.kit==='ie-spruce-sapling').length,saplingTriangles,instances:vegetationPositions.filter(p=>kits.some(([kit])=>kit===p.kit)).length}
  return{root,geometries,materials}
 },[kits,name,gltfs])
 useEffect(()=>()=>{field.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()});field.geometries.forEach(g=>g.dispose());field.materials.forEach(m=>m.dispose())},[field])
 return <primitive object={field.root} dispose={null}/>
}

export function IslandTrees(){
 const loaded=useUiStore(s=>s.loadingDone)
 return <>
  <TreeField kits={adultKits} name="aholo-island-trees"/>
  {loaded&&<Suspense fallback={null}><TreeField kits={youngKits} name="aholo-young-trees"/></Suspense>}
 </>
}
