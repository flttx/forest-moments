import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {lanternAt,launchStand,maxLanterns} from '../game/lanterns'
import {groundHeightAt} from '../game/movement'

const paper='#ffb45c'
/** A soft round glow laid on the water under each lantern. */
const glowShader={
 vertex:/* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragment:/* glsl */`uniform float opacity;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.0;gl_FragColor=vec4(1.0,.62,.28,(1.0-smoothstep(.0,1.0,d))*opacity*.55);}`,
}

/** One paper lantern: a small wooden float, a tapered paper shade lit from inside, and its glow on the water. */
function makeLantern(){
 const group=new THREE.Group()
 const base=new THREE.Mesh(new THREE.BoxGeometry(.2,.035,.2),new THREE.MeshStandardMaterial({color:'#7a5534',roughness:.9}))
 const shade=new THREE.Mesh(new THREE.CylinderGeometry(.065,.09,.16,4,1,true),new THREE.MeshStandardMaterial({color:paper,emissive:paper,emissiveIntensity:2.6,side:THREE.DoubleSide,roughness:.8,transparent:true}))
 shade.rotation.y=Math.PI/4;shade.position.y=.1
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.1),new THREE.ShaderMaterial({vertexShader:glowShader.vertex,fragmentShader:glowShader.fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{opacity:{value:1}}}))
 glow.rotation.x=-Math.PI/2;glow.position.y=.005
 group.add(base,shade,glow);group.visible=false
 return group
}

/**
 * River lanterns (docs/GAMEPLAY_TIER1_PLAN.md T4): a fixed pool of lanterns, each placed along the creek by its age.
 * The lantern stone marks where to stand. Reduced motion keeps them still where they were set down.
 */
export function RiverLanterns(){
 const pool=useMemo(()=>Array.from({length:maxLanterns},makeLantern),[])
 const group=useRef<THREE.Group>(null)
 const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)'),[])
 const night=useRef(0)
 useFrame((_,delta)=>{
  const s=useForestStore.getState(),now=Date.now(),launched=s.lanterns.launched
  // Brighter as the light goes; still visible, faintly, if the sleep journey carries them into morning.
  night.current+=((s.timeOfDay==='day'?.35:1)-night.current)*(1-Math.exp(-Math.min(delta,.05)*1.5))
  ;(group.current?.children??[]).forEach((o,i)=>{
   const at=launched[i],p=at===undefined?null:lanternAt(reduced.matches?Math.min((now-at)/1000,.5):(now-at)/1000,at%97)
   o.visible=!!p;if(!p)return
   o.position.set(p.x,p.y,p.z);o.rotation.y=p.yaw
   const [,shade,glow]=o.children as THREE.Mesh[]
   const m=shade.material as THREE.MeshStandardMaterial;m.opacity=p.opacity;m.emissiveIntensity=2.6*night.current*(.92+.08*Math.sin(now/180+i))
   ;(glow.material as THREE.ShaderMaterial).uniforms.opacity.value=p.opacity*night.current
  })
 })
 const y=groundHeightAt(launchStand.x,launchStand.z)
 return <>
  <group ref={group} name="river-lanterns">{pool.map((o,i)=><primitive key={i} object={o}/>)}</group>
  <mesh name="lantern-stone" position={[launchStand.x+.1,y+.02,launchStand.z-.45]} rotation={[0,.4,0]} scale={[1,.18,.7]} receiveShadow castShadow>
   <dodecahedronGeometry args={[.42,0]}/><meshStandardMaterial color="#8f8a7c" roughness={.95}/>
  </mesh>
 </>
}
