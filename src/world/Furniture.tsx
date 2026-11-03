import {Suspense,useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {madeOf,type RecipeId} from '../game/recipes'
import {furniturePlaces} from '../game/furniture'
import {groundHeightAt} from '../game/movement'
import {mapleLeafShape} from './mapleLeaf'

const models:Record<Exclude<RecipeId,'mapleCharm'|'birchFrame'>,string>={table:'small-wood-table',birdhouse:'birdhouse',rodRack:'fishing-rod-rack',signpost:'wood-signpost'}
const leafShape=mapleLeafShape(.075)

/** Three maple leaves on threads from a short twig, hung in front of the north window. */
function mapleCharm(){
 const g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:'#6b4a2e',roughness:.9}),thread=new THREE.MeshStandardMaterial({color:'#d8ccb0',roughness:1})
 const twig=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.42,6).rotateZ(Math.PI/2),wood);twig.position.y=.45;g.add(twig)
 const hang=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.3,4),thread);hang.position.y=.6;g.add(hang)
 ;[['#a8402a',-.14,.22],['#c4762c',0,.12],['#b85a2a',.14,.2]].forEach(([c,x,drop])=>{
  const string=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,drop as number,4),thread);string.position.set(x as number,.45-(drop as number)/2,0);g.add(string)
  const leaf=new THREE.Mesh(new THREE.ShapeGeometry(leafShape,2),new THREE.MeshStandardMaterial({color:c as string,roughness:.85,side:THREE.DoubleSide}));leaf.position.set(x as number,.45-(drop as number)-.04,0);leaf.rotation.y=(x as number)*3;leaf.name='charm-leaf';g.add(leaf)
 })
 return g
}
/** A birch-bark frame round a pressed maple leaf, hung on the south wall. */
function birchFrame(){
 const g=new THREE.Group(),bark=new THREE.MeshStandardMaterial({color:'#e2d8c4',roughness:.9}),dash=new THREE.MeshStandardMaterial({color:'#3b332c',roughness:.9})
 for(const [w,h,x,y] of [[.46,.06,0,.2],[.46,.06,0,-.2],[.06,.46,-.2,0],[.06,.46,.2,0]]){const side=new THREE.Mesh(new THREE.BoxGeometry(w,h,.03),bark);side.position.set(x,y,0);g.add(side)}
 // dark lenticel dashes across the bark
 for(let i=0;i<10;i++){const d=new THREE.Mesh(new THREE.BoxGeometry(.04,.006,.032),dash);const side=i%4;d.position.set(side<2?(i*.037-.17):(side===2?-.2:.2),side<2?(side?.2:-.2):(i*.033-.15),.002);if(side>=2)d.rotation.z=Math.PI/2;g.add(d)}
 const paper=new THREE.Mesh(new THREE.PlaneGeometry(.34,.34),new THREE.MeshStandardMaterial({color:'#efe6d0',roughness:.95}));paper.position.z=-.005;g.add(paper)
 const leaf=new THREE.Mesh(new THREE.ShapeGeometry(leafShape,2),new THREE.MeshStandardMaterial({color:'#b5582c',roughness:.85}));leaf.scale.setScalar(1.6);leaf.position.z=.002;g.add(leaf)
 return g
}

function Made({id}:{id:'mapleCharm'|'birchFrame'}){
 const object=useMemo(()=>id==='mapleCharm'?mapleCharm():birchFrame(),[id])
 useEffect(()=>()=>object.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose()}}),[object])
 const f=furniturePlaces[id]
 return <group name={`furniture-${id}`} position={[f.x,f.y??0,f.z]} rotation={[0,f.yaw,0]}><primitive object={object}/></group>
}

function Piece({id}:{id:Exclude<RecipeId,'mapleCharm'|'birchFrame'>}){
 const gltf=useGLTF(`/assets/x3/${models[id]}.glb`)
 const object=useMemo(()=>{const o=gltf.scene.clone(true);o.traverse(m=>{if(m instanceof THREE.Mesh){m.castShadow=true;m.receiveShadow=true}});return o},[gltf])
 const f=furniturePlaces[id],ground=f.place==='bedroom'?0:groundHeightAt(f.x,f.z)
 return <group name={`furniture-${id}`} position={[f.x,ground+(f.y??0),f.z]} rotation={[0,f.yaw,0]}><primitive object={object}/></group>
}

/** Finished workshop pieces standing at their fixed places on the island or in the bedroom. */
export function Furniture({place}:{place:'island'|'bedroom'}){
 const made=useForestStore(s=>madeOf(s.workshopBook))
 return <Suspense fallback={null}>{made.filter(id=>furniturePlaces[id].place===place).map(id=>id==='mapleCharm'||id==='birchFrame'?<Made key={id} id={id}/>:<Piece key={id} id={id}/>)}</Suspense>
}
