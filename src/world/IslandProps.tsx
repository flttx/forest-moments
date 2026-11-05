import {Suspense,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {groundHeightAt} from '../game/movement'
import {islandSigns} from './islandSetPieces'

/** The main island's wooden signpost, one at the head of each neighbour island's trail. */
function Signs(){
 const gltf=useGLTF('./assets/x3/wood-signpost.glb')
 const objects=useMemo(()=>islandSigns.map(()=>{const o=gltf.scene.clone(true);o.traverse(m=>{if(m instanceof THREE.Mesh){m.castShadow=true;m.receiveShadow=true}});return o}),[gltf])
 return <>{islandSigns.map((s,i)=><group key={s.island} name={`island-sign-${s.island}`} position={[s.x,groundHeightAt(s.x,s.z),s.z]} rotation={[0,s.yaw,0]}><primitive object={objects[i]}/></group>)}</>
}

/** Neighbour-island wayfinding; the benches and lamps come with the main island's seats and lanterns. */
export function IslandProps(){
 return <Suspense fallback={null}><Signs/></Suspense>
}
