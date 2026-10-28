import {Suspense,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {useWeatherStore} from '../game/weatherStore'
import {availableSpots,type ForageKind} from '../game/forage'
import {groundHeightAt} from '../game/movement'
import {eggReady,eggSpot} from '../game/farm'

/**
 * Today's gatherables and the waiting egg, as the Lux3D props (plan X3, docs/evidence/assets/2026-10-27-x3-lux3d/):
 * real-size models with their origin at the bottom centre, one clone per spot; picked ones disappear.
 */
const models:Record<ForageKind|'egg',string>={mushroom:'mushroom-cluster',berry:'berry-twig',shell:'seashell',pinecone:'pinecone',egg:'egg-nest'}
// Shells lie on the sand rather than standing on their hinge; half their thickness keeps them above it.
const pose:Partial<Record<ForageKind,{tilt:number;lift:number}>>={shell:{tilt:-Math.PI/2,lift:.028}}

function Prop({id}:{id:ForageKind|'egg'}){
 const gltf=useGLTF(`/assets/x3/${models[id]}.glb`)
 const object=useMemo(()=>{const o=gltf.scene.clone(true);o.traverse(m=>{if(m instanceof THREE.Mesh){m.castShadow=true;m.receiveShadow=true}});return o},[gltf])
 const p=id==='egg'?undefined:pose[id]
 return <primitive object={object} rotation={[p?.tilt??0,0,0]} position={[0,p?.lift??0,0]}/>
}

function Egg(){
 const ready=useForestStore(s=>eggReady(s.farmBook,s.homeBook.nights))
 if(!ready)return null
 return <group name="farm-egg" position={[eggSpot.x-.3,groundHeightAt(eggSpot.x-.3,eggSpot.z-.1),eggSpot.z-.1]}><Prop id="egg"/></group>
}

export function ForageItems(){
 const book=useForestStore(s=>s.forageBook),day=useForestStore(s=>s.homeBook.nights)
 // Rain brings more mushrooms, so a changed sky (read here to redraw) changes today's spots.
 useWeatherStore(s=>s.forced)
 const spots=availableSpots(book,day)
 return <Suspense fallback={null}><group name="forage-items">{spots.map(s=><group key={s.id} name={`forage-${s.id}`} position={[s.x,groundHeightAt(s.x,s.z),s.z]} rotation={[0,(s.x*13+s.z*7)%6.28,0]}><Prop id={s.kind}/></group>)}<Egg/></group></Suspense>
}
