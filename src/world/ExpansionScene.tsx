import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {cabin,camp,bridge,seats,reefs} from '../game/expansion'
import {createCreekGeometry} from './creekGeometry'
import {useForestStore} from '../game/store'
import {terrainHeight} from './terrain'

export function ExpansionModel({id,position=[0,0,0],rotation=0,scale=1}:{id:string;position?:[number,number,number];rotation?:number;scale?:number}){
 const gltf=useGLTF(`/assets/expansion/${id}.glb`)
 const model=useMemo(()=>{const s=gltf.scene.clone(true);s.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true}});return s},[gltf.scene])
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

function Campfire(){
 const fire=useRef<THREE.Group>(null),light=useRef<THREE.PointLight>(null),time=useRef(0)
 const lit=useForestStore(s=>s.homeBook.fireLit)
 useFrame((_,dt)=>{time.current+=Math.min(dt,.05);const t=time.current,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(fire.current)fire.current.children.forEach((o,i)=>{o.scale.y=reduced?.8:.6+.35*(.5+.5*Math.sin(t*(3+i%3)+i));o.rotation.y=t*.2+i;if(o.name==='ember'){o.position.y=.4+(t*.25+i*.2)%1.4;o.visible=!reduced}});if(light.current)light.current.intensity=lit?(reduced?7:7+Math.sin(t*9)*.6):0})
 return <group position={[camp.x,0,camp.z]} name="campfire">
  <ExpansionModel id="firepit"/>
  <group ref={fire} visible={lit}>{Array.from({length:7},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*.23,.28,Math.cos(i*2.4)*.23]} scale={[.7,1,.7]}><latheGeometry args={[[new THREE.Vector2(0,0),new THREE.Vector2(.16,.08),new THREE.Vector2(.20,.22),new THREE.Vector2(.12,.42),new THREE.Vector2(.07,.62),new THREE.Vector2(0,.8)],10]}/><meshBasicMaterial color={i%2?'#ffb845':'#ed7226'} transparent opacity={.8} depthWrite={false}/></mesh>)}{Array.from({length:8},(_,i)=><mesh key={`e${i}`} name="ember" position={[Math.sin(i)*.3,.5,Math.cos(i)*.3]}><sphereGeometry args={[.013,5,4]}/><meshBasicMaterial color="#ffd27b"/></mesh>)}</group>
  <pointLight ref={light} position={[0,.8,0]} color="#ffad55" intensity={lit?7:0} distance={9} decay={2}/>
 </group>
}

export function ExpansionExterior(){return <group name="expansion-exterior">
 <ExpansionModel id="cabin" position={[cabin.x,7.3,cabin.z]}/>
 <Creek/>
 <ExpansionModel id="bridge" position={[bridge.x,6,bridge.z]}/>
 <Campfire/>
 {seats.map(s=><ExpansionModel key={s.id} id="low-bench" position={[s.x,terrainHeight(s.x,s.z),s.z]} rotation={s.yaw+Math.PI/2} scale={7/3}/>)}
 {reefs.map((r,i)=><ExpansionModel key={i} id="reef" position={[r.x,terrainHeight(r.x,r.z)-.15,r.z]} rotation={r.yaw} scale={r.scale}/>)}
 </group>}

function TankResidents(){
 const source=useGLTF('/assets/models/fish-koi.glb')
 const fish=useForestStore(s=>s.homeBook.fish)
 const residents=useMemo(()=>fish.map((f,i)=>{const root=clone(source.scene);root.scale.setScalar(Math.min(.29,f.sizeCm/100));const mixer=new THREE.AnimationMixer(root);for(const clip of source.animations)mixer.clipAction(clip).play();return{root,mixer,phase:i*2.4}}),[fish,source])
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
  <hemisphereLight args={['#ffe5bc','#463223',1.1]}/>
  <pointLight position={[0,2.8,.4]} color="#ffd4a0" intensity={18} distance={9} castShadow shadow-mapSize={[512,512]} shadow-bias={-.001}/>
  <pointLight position={[0,2.1,-2.2]} color={day?'#d4e4e5':'#97b4dc'} intensity={day?7:2} distance={5}/>
  <pointLight position={[2.3,1.3,-1.3]} color="#b5e6d2" intensity={1.8} distance={3}/>
 </group>
}
