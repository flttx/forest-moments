import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {mistHeight} from './mistIsland'
import {mistLogs} from './mistDetails'

export function MistLogs(){
 const gltf=useGLTF('/assets/expansion/hollow-log.glb')
 const mesh=useMemo(()=>{
  const source=gltf.scene.getObjectByName('Hollow_Log')
  if(!(source instanceof THREE.Mesh))throw new Error('Hollow log asset is missing')
  source.geometry.computeBoundingBox()
  const bottom=source.geometry.boundingBox!.min.y
  const instances=new THREE.InstancedMesh(source.geometry,source.material,mistLogs.length),m=new THREE.Object3D()
  mistLogs.forEach((p,i)=>{
   // These two sites are nearly level; embed the lowest wood edge slightly in the turf.
   const ground=Math.min(...[-1.4,0,1.4].map(x=>mistHeight(p.x+x*p.scale*Math.cos(p.yaw),p.z-x*p.scale*Math.sin(p.yaw))))
   m.position.set(p.x,ground-bottom*p.scale-.065,p.z);m.rotation.set(0,p.yaw,0);m.scale.setScalar(p.scale);m.updateMatrix();instances.setMatrixAt(i,m.matrix)
  })
  instances.name='mist-hollow-logs';instances.castShadow=true;instances.receiveShadow=true;instances.computeBoundingSphere()
  instances.userData.qa={count:mistLogs.length,geometryTriangles:source.geometry.index?source.geometry.index.count/3:source.geometry.attributes.position.count/3,bounds:source.geometry.boundingBox,decimated:false}
  return instances
 },[gltf.scene])
 useEffect(()=>()=>mesh.dispose(),[mesh])
 return <primitive object={mesh} dispose={null}/>
}
