import {dressFish} from './fishLook'
import {kindOf} from '../game/fishing'
import {roastSeconds} from '../game/campfire'
import {PhotoWall} from './PhotoWall'
import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {cabin,camp,bridge,seats,reefs} from '../game/expansion'
import {createCreekGeometry} from './creekGeometry'
import {useForestStore} from '../game/store'
import {terrainHeight} from './terrain'
import {daylightAt,lanternPower} from '../game/dayCycle'
import CampfireFlame from './CampfireFlame'

/** Night glow shared by cabin panes and resting embers; follows the same curve as the path lanterns. */
const nightGlow={value:0}
function NightGlowClock(){useFrame(()=>{nightGlow.value=lanternPower(daylightAt(useForestStore.getState()))});return null}

/**
 * The cabin atlas paints its panes as the only bright, saturated amber; darker wood and pale plaster stay unlit.
 * A roughness floor keeps the glossy slate from flaring into a white bloom at grazing sun angles.
 */
function withWindowGlow(material:THREE.Material){
 if(!(material instanceof THREE.MeshStandardMaterial))return material
 const lit=material.clone()
 lit.onBeforeCompile=s=>{
  s.uniforms.windowGlow=nightGlow
  s.fragmentShader='uniform float windowGlow;\n'+s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n   roughnessFactor=max(roughnessFactor,.6);').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec3 pane=diffuseColor.rgb;float hi=max(pane.r,max(pane.g,pane.b)),lo=min(pane.r,min(pane.g,pane.b));
   float amber=smoothstep(.5,.72,hi)*smoothstep(.72,.9,(hi-lo)/max(hi,1e-3))*step(pane.b,pane.g)*step(pane.g*1.4,pane.r);
   totalEmissiveRadiance+=vec3(1.0,.58,.24)*amber*windowGlow*3.4;`)
 }
 return lit
}

/** The AHOLO reef scan keeps its photo colour and contrast; pull it toward the coastal kit's warm grey so it sits with the hand-made rocks. */
function withCoastStone(material:THREE.Material){
 if(!(material instanceof THREE.MeshStandardMaterial))return material
 const stone=material.clone()
 stone.onBeforeCompile=s=>{
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float stoneLuma=mix(dot(diffuseColor.rgb,vec3(.299,.587,.114)),.2,.35);
   diffuseColor.rgb=mix(diffuseColor.rgb,stoneLuma*vec3(1.1,1.02,.84),.75);`)
 }
 return stone
}

export function ExpansionModel({id,position=[0,0,0],rotation=0,scale=1,windows=false,stone=false}:{id:string;position?:[number,number,number];rotation?:number;scale?:number;windows?:boolean;stone?:boolean}){
 const gltf=useGLTF(`/assets/expansion/${id}.glb`)
 const model=useMemo(()=>{const s=gltf.scene.clone(true);s.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;if(windows)o.material=withWindowGlow(o.material);if(stone)o.material=withCoastStone(o.material)}});return s},[gltf.scene,windows,stone])
 return <group name={`expansion-${id}`} position={position} rotation={[0,rotation,0]} scale={scale}><primitive object={model} dispose={null}/></group>
}

function Creek(){
 const material=useRef<THREE.MeshStandardMaterial>(null)
 const geometry=useMemo(()=>createCreekGeometry(),[])
 const time=useRef({value:0})
 useFrame((_,dt)=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)time.current.value+=Math.min(dt,.05)})
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <mesh geometry={geometry} name="woodland-creek" receiveShadow><meshStandardMaterial ref={material} color="#447e76" roughness={.42} transparent depthWrite={false} side={THREE.DoubleSide} onBeforeCompile={s=>{
  s.uniforms.streamTime=time.current
  s.vertexShader='attribute float streamAlpha;varying float streamFade;varying vec2 streamUv;\n'+s.vertexShader
  s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nstreamUv=uv;streamFade=streamAlpha;')
  s.fragmentShader='uniform float streamTime;varying vec2 streamUv;varying float streamFade;\n'+s.fragmentShader
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ripple=sin(streamUv.x*9.0+streamTime*2.5+sin(streamUv.y*8.0));
   float edge=abs(streamUv.y*2.0-1.0);
   diffuseColor.rgb*=.95+.05*ripple;
   float thread=pow(max(0.0,ripple),12.0)*(1.0-smoothstep(.45,.95,edge));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.35,.51,.43),thread*.16);
   diffuseColor.a*=streamFade*(1.0-smoothstep(.83,1.0,edge));`)
 }}/></mesh>
}

/** A few coals keep a faint glow after dusk even when the fire is out; brighter under live flames. */
function Embers({lit}:{lit:boolean}){
 const coals=useRef<THREE.Group>(null)
 useFrame(()=>{const glow=lit?2.4:nightGlow.value*1.4;coals.current?.children.forEach(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial)o.material.emissiveIntensity=glow})})
 return <group ref={coals} name="campfire-embers">{Array.from({length:6},(_,i)=><mesh key={i} position={[Math.sin(i*1.9)*.13,.14,Math.cos(i*1.9)*.13]} rotation={[i,i*2,0]} scale={[.07,.045,.06]}><icosahedronGeometry args={[1,0]}/><meshStandardMaterial color="#2a1a12" roughness={.9} emissive="#ff5a1f" emissiveIntensity={0}/></mesh>)}</group>
}

/** A fish on a green stick over the fire while it roasts; it turns slowly and browns as it cooks. */
function RoastSpit(){
 const source=useGLTF('/assets/models/fish-koi.glb')
 const roast=useForestStore(s=>s.roast)
 const kind=roast?.species,size=roast?.sizeCm
 const fish=useMemo(()=>{if(!kind||!size)return null;const root=clone(source.scene);dressFish(root,kind);root.scale.setScalar(size/100);return root},[source,kind,size])
 const spin=useRef<THREE.Group>(null),cooked=new THREE.Color('#7b4a28')
 useFrame((_,dt)=>{
  const r=useForestStore.getState().roast;if(!r||!fish||!spin.current)return
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)spin.current.rotation.x+=Math.min(dt,.05)*.9
  const k=Math.min(1,r.elapsed/roastSeconds)*.55
  fish.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial){const base=new THREE.Color(o.material.userData.base??(o.material.userData.base=`#${o.material.color.getHexString()}`));o.material.color.copy(base).lerp(cooked,k)}})
 })
 if(!fish)return null
 return <group name="roast-spit" position={[0,.62,0]}>
  {[-.42,.42].map(x=><mesh key={x} position={[x,-.3,0]} rotation={[0,0,x>0?-.12:.12]}><cylinderGeometry args={[.018,.022,.66,6]}/><meshStandardMaterial color="#6b4a2e" roughness={.95}/></mesh>)}
  <group ref={spin}>
   <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.012,.012,.98,6]}/><meshStandardMaterial color="#8a6a3f" roughness={.9}/></mesh>
   <primitive object={fish} rotation={[0,Math.PI/2,0]}/>
  </group>
 </group>
}

function Campfire(){
 const lit=useForestStore(s=>s.homeBook.fireLit)
 return <group position={[camp.x,0,camp.z]} name="campfire">
  <ExpansionModel id="firepit"/>
  <CampfireFlame lit={lit}/>
  <Embers lit={lit}/>
  <RoastSpit/>
 </group>
}

export function ExpansionExterior(){return <group name="expansion-exterior">
 <NightGlowClock/>
 <ExpansionModel id="cabin" position={[cabin.x,7.3,cabin.z]} windows/>
 <Creek/>
 <ExpansionModel id="bridge" position={[bridge.x,6,bridge.z]}/>
 <Campfire/>
 {seats.map(s=><ExpansionModel key={s.id} id="low-bench" position={[s.x,terrainHeight(s.x,s.z),s.z]} rotation={s.yaw+Math.PI/2} scale={7/3}/>)}
 {reefs.map((r,i)=><ExpansionModel key={i} id="reef" stone position={[r.x,terrainHeight(r.x,r.z)-.15,r.z]} rotation={r.yaw} scale={r.scale}/>)}
 </group>}

function TankResidents(){
 const source=useGLTF('/assets/models/fish-koi.glb')
 const fish=useForestStore(s=>s.homeBook.fish)
 const residents=useMemo(()=>fish.map((f,i)=>{const root=clone(source.scene);dressFish(root,kindOf(f));root.scale.setScalar(Math.min(.29,f.sizeCm/100));const mixer=new THREE.AnimationMixer(root);for(const clip of source.animations)mixer.clipAction(clip).play();return{root,mixer,phase:i*2.4}}),[fish,source])
 useEffect(()=>()=>residents.forEach(r=>r.mixer.stopAllAction()),[residents])
 const elapsed=useRef(0)
 const runtime=useRef(residents);useEffect(()=>{runtime.current=residents},[residents])
 useFrame((_,dt)=>{const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!reduced)elapsed.current+=Math.min(dt,.05)*.42;for(const r of runtime.current){if(!reduced)r.mixer.update(Math.min(dt,.05));const t=r.phase+elapsed.current;r.root.position.set(Math.cos(t)*.61,1.22+Math.sin(t*1.3)*.12,Math.sin(t)*.19);r.root.rotation.set(0,Math.atan2(-Math.sin(t)*.61,Math.cos(t)*.19),0)}})
 return <group name="aquarium-residents">{residents.map((r,i)=><primitive key={fish[i].id} object={r.root} dispose={null}/>)}</group>
}

export function Bedroom(){
 const inside=useForestStore(s=>s.location==='bedroom'&&s.mode!=='sleeping')
 const day=useForestStore(s=>s.timeOfDay==='day')
 useEffect(()=>{useForestStore.setState({homeReady:true});return()=>useForestStore.setState({homeReady:false})},[])
 return <group name="bedroom-interior" visible={inside}>
  <ExpansionModel id="bedroom-shell"/>
  <ExpansionModel id="bed" position={[-2.2,0,-.65]}/>
  <group position={[2.3,0,-1.3]} scale={.72}>
  <ExpansionModel id="tank"/>
  <mesh position={[0,1.29,0]} renderOrder={2}><boxGeometry args={[1.76,.73,.65]}/><meshPhysicalMaterial color="#a8d6cd" transparent opacity={.1} roughness={.15} metalness={0} depthWrite={false} side={THREE.DoubleSide}/></mesh>
  <mesh position={[0,1.61,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.76,.65]}/><meshPhysicalMaterial color="#78b9a3" transparent opacity={.25} roughness={.2} depthWrite={false}/></mesh>
  <TankResidents/>
  </group>
  <PhotoWall/>
  <hemisphereLight args={['#ffe5bc','#463223',1.1]}/>
  <pointLight position={[0,2.8,.4]} color="#ffd4a0" intensity={18} distance={9} castShadow shadow-mapSize={[512,512]} shadow-bias={-.001}/>
  <pointLight position={[0,2.1,-2.2]} color={day?'#d4e4e5':'#97b4dc'} intensity={day?7:2} distance={5}/>
  <pointLight position={[2.3,1.3,-1.3]} color="#b5e6d2" intensity={1.8} distance={3}/>
 </group>
}
