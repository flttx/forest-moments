import {useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import {Mesh} from 'three'
import {coastalDock} from './worldConfig'

/** AHOLO task 4321451, normalized in Blender; deck origin is local y=0. */
export function SeasideDock(){
  const gltf=useGLTF('/assets/models/coastal-jetty.glb',true,true)
  const model=useMemo(()=>{
    const scene=gltf.scene.clone(true)
    scene.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true}})
    return scene
  },[gltf.scene])
  // Deck origin stays fixed; the outer piles extend 6–7 cm into the seabed.
  return <group name="asset-coastal-jetty" position={[(coastalDock.minX+coastalDock.maxX)/2,coastalDock.deckY,0]} scale={[1,1.06,1]}><primitive object={model} dispose={null}/></group>
}
