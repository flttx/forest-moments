import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {tideHeight} from './tideIsland'
import {tideDriftwood} from './tideDetailsLayout'

/** Reuses the coastal driftwood GLB; only the instance buffers are owned here. */
export function TideDetails(){
 const coast=useGLTF('/assets/expansion/coastal-kit.glb')
 const root=useMemo(()=>{
  const group=new THREE.Group()
  const instance=(name:string,source:THREE.Object3D|undefined,items:{x:number;z:number;scale:number;yaw:number}[],sink:number)=>{
   if(!(source instanceof THREE.Mesh))throw new Error('Tide detail asset is missing')
   const bottom=new THREE.Box3().setFromBufferAttribute(source.geometry.getAttribute('position') as THREE.BufferAttribute).min.y
   const o=new THREE.Object3D(),mesh=new THREE.InstancedMesh(source.geometry,source.material,items.length)
   items.forEach((p,i)=>{o.position.set(p.x,tideHeight(p.x,p.z)-bottom*p.scale-sink,p.z);o.rotation.set(0,p.yaw,0);o.scale.setScalar(p.scale);o.updateMatrix();mesh.setMatrixAt(i,o.matrix)})
   mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh)
  }
  for(const kit of ['Driftwood_Long','Driftwood_Short'] as const)instance(`tide-${kit}`,coast.scene.getObjectByName(kit),tideDriftwood.filter(p=>p.kit===kit),.05)
  group.userData.qa={driftwood:tideDriftwood.length,decimated:false}
  return group
 },[coast.scene])
 useEffect(()=>()=>root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()}),[root])
 return <primitive object={root} dispose={null}/>
}
