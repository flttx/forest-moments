import {Suspense,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {madeOf,type RecipeId} from '../game/recipes'
import {furniturePlaces} from '../game/furniture'
import {groundHeightAt} from '../game/movement'

const models:Record<RecipeId,string>={table:'small-wood-table',birdhouse:'birdhouse',rodRack:'fishing-rod-rack',signpost:'wood-signpost'}

function Piece({id}:{id:RecipeId}){
 const gltf=useGLTF(`/assets/x3/${models[id]}.glb`)
 const object=useMemo(()=>{const o=gltf.scene.clone(true);o.traverse(m=>{if(m instanceof THREE.Mesh){m.castShadow=true;m.receiveShadow=true}});return o},[gltf])
 const f=furniturePlaces[id],ground=f.place==='bedroom'?0:groundHeightAt(f.x,f.z)
 return <group name={`furniture-${id}`} position={[f.x,ground+(f.y??0),f.z]} rotation={[0,f.yaw,0]}><primitive object={object}/></group>
}

/** Finished workshop pieces standing at their fixed places on the island or in the bedroom. */
export function Furniture({place}:{place:'island'|'bedroom'}){
 const made=useForestStore(s=>madeOf(s.workshopBook))
 return <Suspense fallback={null}>{made.filter(id=>furniturePlaces[id].place===place).map(id=><Piece key={id} id={id}/>)}</Suspense>
}
