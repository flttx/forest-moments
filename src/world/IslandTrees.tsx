import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {vegetationPositions} from './vegetationLayout'
import {terrainHeight} from './terrain'
import {transformedGeometry} from './transformedGeometry'
import {patchFoliageMaterial} from './foliageMaterial'
import {climateUniforms} from './climateUniforms'
import {patchAutumnTreeMaterial} from './autumnTreeMaterial'

/** Full-detail AHOLO trees, instanced in small chunks. Simplification requires measured need and visual review. */
export function IslandTrees(){
 const pine=useGLTF('/assets/island-trees/old-pine.glb')
 const spruce=useGLTF('/assets/island-trees/spruce.glb')
 const sapling=useGLTF('/assets/island-trees/spruce-sapling.glb')
 const birch=useGLTF('/assets/island-trees/birch.glb')
 const maple=useGLTF('/assets/island-trees/maple.glb')
 const field=useMemo(()=>{
  const root=new THREE.Group();root.name='aholo-island-trees'
  const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[]
  const dummy=new THREE.Object3D()
  let saplingTriangles=0
  for(const [kit,high] of [['ie-old-pine',pine.scene],['ie-spruce',spruce.scene],['ie-spruce-sapling',sapling.scene],['ie-birch',birch.scene],['ie-maple',maple.scene]] as const){
   const items=vegetationPositions.filter(p=>p.kit===kit),groups=new Map<string,typeof items>()
   for(const p of items){const key=`${Math.floor(p.x/8)},${Math.floor(p.z/8)}`;groups.set(key,[...(groups.get(key)??[]),p])}
   const source=(scene:THREE.Group)=>{
    scene.updateMatrixWorld(true)
    const parts:{geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]}[]=[]
    scene.traverse(o=>{
     if(!(o instanceof THREE.Mesh))return
     const geometry=transformedGeometry(o.geometry,o.matrixWorld);geometries.push(geometry)
     const clone=(m:THREE.Material)=>{const copy=m.clone();if(kit==='ie-birch'||kit==='ie-maple')patchAutumnTreeMaterial(copy,kit==='ie-birch'?'birch':'maple');else patchFoliageMaterial(copy,climateUniforms.climatePine);materials.push(copy);return copy}
     parts.push({geometry,material:Array.isArray(o.material)?o.material.map(clone):clone(o.material)})
    })
    return parts
   }
   const highParts=source(high)
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
  }
  root.userData.qa={saplings:vegetationPositions.filter(p=>p.kit==='ie-spruce-sapling').length,saplingTriangles}
  return{root,geometries,materials}
 },[pine.scene,spruce.scene,sapling.scene,birch.scene,maple.scene])
 useEffect(()=>()=>{field.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()});field.geometries.forEach(g=>g.dispose());field.materials.forEach(m=>m.dispose())},[field])
 return <primitive object={field.root} dispose={null}/>
}
