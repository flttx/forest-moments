import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useLoader} from '@react-three/fiber'
import {useGLTF} from '@react-three/drei'
import {Group,Mesh,MeshStandardMaterial,MeshBasicMaterial,TextureLoader,LinearFilter,NoColorSpace} from 'three'
import {useForestStore} from '../game/store'
import {woodSpot,workpieceSpot} from '../game/workshop'
import {groundHeightAt} from '../game/movement'

const base='/assets/interiors/'
const bakedNames=['Room_Baked','Hero_workshop-workbench','Hero_workshop-stove']
const bakeFiles=['workshop-light','workshop-workbench-light','workshop-stove-light']
const light=new URLSearchParams(location.search).get('light')
const day=light==='night'?0:light==='dusk'?.35:1

/** Reuse the complete authored room, its atlas UVs and original day/night irradiance maps. */
export function WorkshopCraft(){
 const gltf=useGLTF(base+'workshop.glb')
 const textures=useLoader(TextureLoader,bakeFiles.flatMap(f=>[base+f+'-day.webp',base+f+'-night.webp']))
 const root=useRef<Group>(null),interior=useRef<Group>(null),dust=useRef<Group>(null)
 const assets=useMemo(()=>{
   const room=gltf.scene.clone(true)
   const materials:(MeshStandardMaterial|MeshBasicMaterial)[]=[]
   room.traverse(o=>{
     if(!(o instanceof Mesh))return
     if(o.name.startsWith('Collider_')||o.name==='Floor_Walk'){o.visible=false;return}
     o.castShadow=true;o.receiveShadow=true
     o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone()
     const mats=Array.isArray(o.material)?o.material:[o.material]
     materials.push(...mats)
     for(const m of mats)if(m instanceof MeshStandardMaterial&&m.name==='glass'){
       m.color.set(light==='night'?'#1c3047':light==='dusk'?'#a17b68':'#b8cad0');m.emissive.copy(m.color);m.emissiveIntensity=.25+.2*day
     }
     const index=bakedNames.indexOf(o.name)
     if(index<0||!(o.material instanceof MeshStandardMaterial))return
     const source=o.material,dayMap=textures[index*2],nightMap=textures[index*2+1]
     for(const t of [dayMap,nightMap]){t.flipY=false;t.colorSpace=NoColorSpace;t.generateMipmaps=false;t.minFilter=LinearFilter;t.needsUpdate=true}
     const material=new MeshBasicMaterial({map:source.map,side:source.side})
     material.onBeforeCompile=shader=>{
       Object.assign(shader.uniforms,{lightDay:{value:dayMap},lightNight:{value:nightMap},dayMix:{value:day},lightScale:{value:4*(3.6-.4*day)}})
       shader.fragmentShader='uniform sampler2D lightDay;uniform sampler2D lightNight;uniform float dayMix;uniform float lightScale;\n'+shader.fragmentShader
       shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
       vec3 bd=texture2D(lightDay,vMapUv).rgb;vec3 bn=texture2D(lightNight,vMapUv).rgb;
       diffuseColor.rgb*=mix(bn*bn,bd*bd,dayMix)*lightScale;`)
     }
     o.material=material;materials.push(material)
   })
   const piece=room.getObjectByName('Prop_workshop-stool')!
   const raw=piece.clone(true)
   raw.traverse(o=>{if(o instanceof Mesh){o.material=(o.material as MeshStandardMaterial).clone();o.material.color.multiplyScalar(.7);o.material.roughness=1;materials.push(o.material)}})
   raw.position.set(woodSpot.x,groundHeightAt(woodSpot.x,woodSpot.z)+.23,woodSpot.z)
   return{room,raw,piece,materials}
 },[gltf.scene,textures])
 const runtime=useRef(assets)
 useEffect(()=>{useForestStore.setState({workshopReady:true});return()=>{useForestStore.setState({workshopReady:false})}},[])
 useEffect(()=>()=>assets.materials.forEach(m=>m.dispose()),[assets])
 useFrame(()=>{
   const assets=runtime.current,s=useForestStore.getState(),inside=s.location==='workshop'
   if(interior.current)interior.current.visible=inside
   assets.raw.visible=!inside&&s.workshopBook.phase==='available'
   assets.piece.visible=s.mode==='crafting'||s.workshopBook.phase==='finished'
   if(dust.current)dust.current.children.forEach((o,i)=>{
     const stroke=s.craft?.stroke??0,t=(.95-stroke)/.95
     o.visible=inside&&s.mode==='crafting'&&stroke>0&&t>.18&&t<.8
     o.position.set(workpieceSpot.x+Math.sin(i*2.4)*t*.35,.46+Math.sin(t*Math.PI)*.12-i*.002,workpieceSpot.z+Math.cos(i*2.4)*t*.35)
   })
   if(import.meta.env.DEV&&root.current)root.current.userData.qa={inside,rawVisible:assets.raw.visible,pieceVisible:inside&&assets.piece.visible,dust:dust.current?.children.filter(o=>o.visible).length}
 })
 return <group ref={root} name="workshop-craft">
   <primitive object={assets.raw} dispose={null}/>
   <group ref={interior} visible={false} name="workshop-interior">
     <primitive object={assets.room} dispose={null}/>
     <hemisphereLight args={['#ffdcae','#2a1c10',.8]}/>
     <pointLight position={[0,2.8,.4]} color="#ffcd90" intensity={8} distance={7} castShadow shadow-mapSize={[512,512]} shadow-bias={-.001}/>
     <pointLight position={[-2,2.8,-1.4]} color="#ffd8aa" intensity={5} distance={5}/>
     <pointLight position={[3,.5,-1.45]} color="#ff8840" intensity={3} distance={3}/>
     <pointLight position={[-3.2,1.7,1.3]} color="#c7dcff" intensity={day*4} distance={5}/>
     <group ref={dust}>{Array.from({length:16},(_,i)=><mesh key={i} visible={false}><boxGeometry args={[.014,.007,.022]}/><meshStandardMaterial color="#b58b58" roughness={1}/></mesh>)}</group>
   </group>
 </group>
}
