import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {autumnHeight} from './autumnIsland'
import {autumnFerns} from './autumnUnderstoryLayout'

/** Reuse IE-03's full geometry and cached material; only this island's instance buffer is owned here. */
export function AutumnUnderstory(){
 const gltf=useGLTF('/assets/expansion/fern-clump.glb')
 const mesh=useMemo(()=>{
  const source=gltf.scene.getObjectByName('Fern_Clump')
  if(!(source instanceof THREE.Mesh))throw new Error('Fern asset module is missing')
  const instances=new THREE.InstancedMesh(source.geometry,source.material,autumnFerns.length),m=new THREE.Object3D()
  autumnFerns.forEach((p,i)=>{
   m.position.set(p.x,autumnHeight(p.x,p.z)-.025,p.z);m.rotation.set(0,p.yaw,0);m.scale.setScalar(p.scale);m.updateMatrix();instances.setMatrixAt(i,m.matrix)
  })
  instances.name='autumn-ferns';instances.receiveShadow=true;instances.castShadow=true;instances.computeBoundingSphere()
  instances.userData.qa={count:autumnFerns.length,geometryTriangles:(source.geometry.index?.count??source.geometry.attributes.position.count)/3,decimated:false}
  return instances
 },[gltf.scene])
 useEffect(()=>()=>mesh.dispose(),[mesh])
 return <primitive object={mesh} dispose={null}/>
}
