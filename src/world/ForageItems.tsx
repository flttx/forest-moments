import {Suspense,useEffect,useMemo} from 'react'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {mapleLeafShape} from './mapleLeaf'
import {useForestStore} from '../game/store'
import {useWeatherStore} from '../game/weatherStore'
import {seasonFor,type Season} from '../game/weather'
import {availableSpots,type ForageKind} from '../game/forage'
import {groundHeightAt} from '../game/movement'
import {eggReady,eggSpot} from '../game/farm'

/**
 * Today's gatherables and the waiting egg, as the Lux3D props (plan X3, docs/evidence/assets/2026-10-27-x3-lux3d/):
 * real-size models with their origin at the bottom centre, one clone per spot; picked ones disappear.
 */
const models:Record<Exclude<ForageKind,'mapleLeaf'|'birchBark'|'seaGlass'>|'egg',string>={mushroom:'mushroom-cluster',berry:'berry-twig',shell:'seashell',pinecone:'pinecone',egg:'egg-nest',mistcap:'mushroom-cluster'}
// Mist caps reuse the mushroom cluster with pale, cool caps, as if grown in fog. Its red caps are painted in the one
// texture, so the shader turns red-dominant texels fog grey and keeps their light and shade; the stems stay as they are.
const tints:Partial<Record<ForageKind,THREE.Color>>={mistcap:new THREE.Color('#c3ccd0')}
function fogCaps(material:THREE.MeshStandardMaterial,tint:THREE.Color){
 material.onBeforeCompile=shader=>{
  shader.uniforms.capTint={value:tint}
  shader.fragmentShader='uniform vec3 capTint;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float capRed=smoothstep(.06,.2,diffuseColor.r-max(diffuseColor.g,diffuseColor.b));
   diffuseColor.rgb=mix(diffuseColor.rgb,capTint*(.45+1.1*dot(diffuseColor.rgb,vec3(.3,.59,.11))),capRed);`)
 }
 material.customProgramCacheKey=()=>'fog-caps'
}
// Shells lie on the sand rather than standing on their hinge; half their thickness keeps them above it.
const pose:Partial<Record<ForageKind,{tilt:number;lift:number}>>={shell:{tilt:-Math.PI/2,lift:.028}}

/** What lies under the maples by season: last year's weathered browns in spring, a few early yellow drops in summer,
 * red, orange and gold in autumn as the crowns turn. None is grass-green, so they still read in the spring grass. */
const leafColours:Record<Season,readonly string[]>={spring:['#8a6a44','#a5845a','#74563a'],summer:['#c2a23c','#b08a34','#a8a046'],autumn:['#a8402a','#c4762c','#c99a34']}
/** Three fallen maple leaves: five pointed lobes, a slight cup, in the season's colours. */
function mapleLeaves(season:Season){
 const geometry=new THREE.ShapeGeometry(mapleLeafShape(.085),2).rotateX(-Math.PI/2)
 const position=geometry.getAttribute('position')
 for(let i=0;i<position.count;i++)position.setY(i,(position.getX(i)**2+position.getZ(i)**2)*1.6)
 geometry.computeVertexNormals()
 const group=new THREE.Group()
 ;[[leafColours[season][0],0,0,0],[leafColours[season][1],.07,.05,2.1],[leafColours[season][2],-.05,.06,4]].forEach(([colour,x,z,yaw])=>{
  const leaf=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colour as string,roughness:.85,side:THREE.DoubleSide}))
  leaf.position.set(x as number,.006,z as number);leaf.rotation.y=yaw as number;leaf.receiveShadow=true;group.add(leaf)
 })
 return group
}
/** A curl of birch bark: a flattened open roll lying on its side, warm chalk white with dark lenticel dashes. */
function birchCurl(){
 const geometry=new THREE.CylinderGeometry(.04,.05,.2,16,10,true,0,Math.PI*1.75).scale(1,1,.6)
 const colours:number[]=[],position=geometry.getAttribute('position')
 for(let i=0;i<position.count;i++){
  // short dark dashes across the grain, broken by angle, as on a real birch
  const y=position.getY(i),a=Math.atan2(position.getZ(i),position.getX(i)),dash=Math.sin(y*110)>.7&&Math.sin(a*5+y*30)>-.2?.32:1
  colours.push(.84*dash,.75*dash,.6*dash)
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3))
 const curl=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide}))
 curl.rotation.set(0,0,Math.PI/2);curl.position.y=.045;curl.castShadow=true;curl.receiveShadow=true
 return new THREE.Group().add(curl)
}

/** Two pieces of sea glass worn smooth by the waves: frosted green and pale blue, catching a little light. */
function seaGlass(){
 const group=new THREE.Group()
 ;[['#7fb59a',0,0,1],['#9cc4cf',.05,.03,.75]].forEach(([colour,x,z,s])=>{
  const piece=new THREE.Mesh(new THREE.IcosahedronGeometry(.022,1).scale(1.3*(s as number),.45*(s as number),(s as number)),new THREE.MeshPhysicalMaterial({color:colour as string,roughness:.55,transmission:.25,thickness:.02,transparent:true,opacity:.85}))
  piece.position.set(x as number,.009,z as number);piece.rotation.y=(x as number)*20;piece.castShadow=true;group.add(piece)
 })
 return group
}
/** Tide Isle shells come from the Blender shell set (scripts/build_shell_set.py), one of four forms per spot. */
const tideShells=['Shell_Scallop','Shell_Turban','Shell_Cowrie','Shell_Clam'] as const
function TideShell({id}:{id:string}){
 const gltf=useGLTF('/assets/expansion/shell-set.glb')
 const object=useMemo(()=>{
  const name=tideShells[[...id].reduce((n,c)=>n+c.charCodeAt(0),0)%tideShells.length]
  const source=gltf.scene.getObjectByName(name)?.clone(true)??new THREE.Group()
  source.position.set(0,0,0);source.traverse(m=>{if(m instanceof THREE.Mesh){m.castShadow=true;m.receiveShadow=true}})
  // the set is modelled at life size; the satchel shells read at the main island's prop scale
  source.scale.setScalar(1.6)
  return source
 },[gltf,id])
 return <primitive object={object}/>
}

function Prop({id}:{id:ForageKind|'egg'}){
 if(id==='mapleLeaf'||id==='birchBark'||id==='seaGlass')return <Made id={id}/>
 return <Model id={id}/>
}
function Made({id}:{id:'mapleLeaf'|'birchBark'|'seaGlass'}){
 const season=useForestStore(s=>seasonFor(s.homeBook.nights))
 const object=useMemo(()=>id==='mapleLeaf'?mapleLeaves(season):id==='birchBark'?birchCurl():seaGlass(),[id,season])
 // picked props unmount: free what was built for them
 useEffect(()=>()=>object.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose()}}),[object])
 return <primitive object={object}/>
}
function Model({id}:{id:Exclude<ForageKind,'mapleLeaf'|'birchBark'|'seaGlass'>|'egg'}){
 const gltf=useGLTF(`/assets/x3/${models[id]}.glb`)
 const object=useMemo(()=>{
  const o=gltf.scene.clone(true),tint=id==='egg'?undefined:tints[id]
  o.traverse(m=>{if(m instanceof THREE.Mesh){m.castShadow=true;m.receiveShadow=true;if(tint){const material=(m.material as THREE.MeshStandardMaterial).clone();fogCaps(material,tint);m.material=material}}})
  return o
 },[gltf,id])
 // only the tinted clones own their materials; the GLTF's shared ones stay cached
 useEffect(()=>()=>{if(id!=='egg'&&tints[id])object.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.Material).dispose()})},[object,id])
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
 return <Suspense fallback={null}><group name="forage-items">{spots.map(s=><group key={s.id} name={`forage-${s.id}`} position={[s.x,groundHeightAt(s.x,s.z),s.z]} rotation={[0,(s.x*13+s.z*7)%6.28,0]}>{s.region==='tide'&&s.kind==='shell'?<TideShell id={s.id}/>:<Prop id={s.kind}/>}</group>)}<Egg/></group></Suspense>
}
