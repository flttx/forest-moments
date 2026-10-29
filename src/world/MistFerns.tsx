import {useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {mistHeight,mistPathDistance,mistRadius,mistPine} from './mistIsland'
import {vegetationPositions} from './vegetationLayout'
import {mistRidgePieces,coastKits} from './coastalLayout'
import {mistLogDistance} from './mistDetails'

// Soft ground cover beside the path and tree roots, not an invisible walking obstacle.
const mistFerns=(()=>{
 const plants:{x:number;z:number;scale:number;yaw:number}[]=[]
 for(let x=93;x<121;x+=1.6)for(let z=-23;z<4;z+=1.6){
  const n=Math.sin(x*12.9+z*37.1)*43758.5,f=n-Math.floor(n),px=x+(f-.5)*.9,pz=z+(f-.5)*.7
  const path=mistPathDistance(px,pz),scale=.72+f*.28
  if(f<.38||mistRadius(px,pz)>.81||mistHeight(px,pz)<.7||path<1.2||path>3.5||mistLogDistance(px,pz)<.4)continue
  if(Math.hypot(px-mistPine.x,pz-mistPine.z)<2.2)continue
  if(vegetationPositions.some(p=>Math.hypot(px-p.x,pz-p.z)<.65))continue
  if(mistRidgePieces.some(p=>Math.hypot(px-p.x,pz-p.z)<coastKits[p.kit].half*p.scale+.4))continue
  plants.push({x:px,z:pz,scale,yaw:f*Math.PI*2})
 }
 // Denser low fronds around shrub groups and decaying wood, without blanketing the path.
 for(const p of vegetationPositions.filter(p=>p.x>72&&p.kit==='bush-a'))for(let i=0;i<3;i++){
  const a=p.yaw+i*2.1,x=p.x+Math.cos(a)*.75,z=p.z+Math.sin(a)*.75
  if(mistRadius(x,z)>.87||mistHeight(x,z)<.7||mistPathDistance(x,z)<1.25||mistLogDistance(x,z)<.4)continue
  if(vegetationPositions.some(t=>Math.hypot(t.x-x,t.z-z)<.55)||plants.some(t=>Math.hypot(t.x-x,t.z-z)<.5))continue
  if(mistRidgePieces.some(t=>Math.hypot(t.x-x,t.z-z)<coastKits[t.kit].half*t.scale+.4))continue
  plants.push({x,z,scale:.65+i*.08,yaw:a})
 }
 return plants
})()

export function MistFerns(){
 const gltf=useGLTF('/assets/expansion/fern-clump.glb')
 const mesh=useMemo(()=>{
  const source=gltf.scene.getObjectByName('Fern_Clump')
  if(!(source instanceof THREE.Mesh))throw new Error('Fern asset module is missing')
  const instances=new THREE.InstancedMesh(source.geometry,source.material,mistFerns.length),m=new THREE.Object3D()
  mistFerns.forEach((p,i)=>{
   m.position.set(p.x,mistHeight(p.x,p.z)-.025,p.z);m.rotation.set(0,p.yaw,0);m.scale.setScalar(p.scale);m.updateMatrix();instances.setMatrixAt(i,m.matrix)
  })
  instances.name='mist-ferns';instances.receiveShadow=true;instances.castShadow=true;instances.computeBoundingSphere()
  instances.userData.qa={count:mistFerns.length,geometryTriangles:source.geometry.index?source.geometry.index.count/3:source.geometry.attributes.position.count/3,decimated:false}
  return instances
 },[gltf.scene])
 useEffect(()=>()=>mesh.dispose(),[mesh])
 return <primitive object={mesh} dispose={null}/>
}
