import {Suspense,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {bottleSpot,jellyfishSpot} from '../game/secrets'
import {groundHeightAt} from '../game/movement'

/** The bottle on the sand, lying on its side and half sunk. */
function Bottle(){
 const gltf=useGLTF('/assets/x3/message-bottle.glb')
 const object=useMemo(()=>gltf.scene.clone(true),[gltf])
 return <group name="secret-bottle" position={[bottleSpot.x,groundHeightAt(bottleSpot.x,bottleSpot.z)+.06,bottleSpot.z]} rotation={[0,.9,Math.PI/2.15]}><primitive object={object}/></group>
}

/** The jellyfish beside the jetty: translucent, gently bobbing, glowing after dark. */
function Jellyfish(){
 const gltf=useGLTF('/assets/x3/glowing-jellyfish.glb')
 const group=useRef<THREE.Group>(null)
 const object=useMemo(()=>{const o=gltf.scene.clone(true);o.traverse(m=>{if(m instanceof THREE.Mesh&&m.material instanceof THREE.MeshStandardMaterial){const mat=m.material.clone();mat.transparent=true;mat.opacity=.82;mat.depthWrite=false;mat.emissive=new THREE.Color('#7fe6d6');mat.emissiveMap=mat.map;m.material=mat}});return o},[gltf])
 useFrame(({clock})=>{
  const s=useForestStore.getState(),glow=s.timeOfDay==='night'?1.1:s.timeOfDay==='dusk'?.35:.05
  group.current?.traverse(m=>{if(m instanceof THREE.Mesh&&m.material instanceof THREE.MeshStandardMaterial)m.material.emissiveIntensity+=(glow-m.material.emissiveIntensity)*.05})
  if(group.current&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const t=clock.elapsedTime;group.current.position.y=jellyfishSpot.y+Math.sin(t*.8)*.05;group.current.rotation.y=t*.12}
 })
 return <group ref={group} name="secret-jellyfish" position={[jellyfishSpot.x,jellyfishSpot.y,jellyfishSpot.z]}><primitive object={object}/></group>
}

export function Secrets(){
 return <Suspense fallback={null}><Bottle/><Jellyfish/></Suspense>
}
