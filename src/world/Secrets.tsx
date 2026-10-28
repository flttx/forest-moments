import {Suspense,useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {useGLTF} from '@react-three/drei'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {bottleSpot,foxDen,heartStone,jellyfishSpot} from '../game/secrets'
import {groundHeightAt} from '../game/movement'
import {initialLookoutView,lookoutEye} from '../game/lookout'
import {terrainHeight} from './terrain'
import {jellyGlow} from './climateUniforms'

const stillMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches

/** The bottle on the sand, lying on its side and half sunk. */
function Bottle(){
 const gltf=useGLTF('/assets/x3/message-bottle.glb')
 const object=useMemo(()=>gltf.scene.clone(true),[gltf])
 return <group name="secret-bottle" position={[bottleSpot.x,groundHeightAt(bottleSpot.x,bottleSpot.z)+.06,bottleSpot.z]} rotation={[0,.9,Math.PI/2.15]}><primitive object={object}/></group>
}

/** The jellyfish beside the jetty: translucent, gently bobbing, glowing after dark (and through the water). */
function Jellyfish(){
 const gltf=useGLTF('/assets/x3/glowing-jellyfish.glb')
 const group=useRef<THREE.Group>(null)
 const object=useMemo(()=>{const o=gltf.scene.clone(true);o.traverse(m=>{if(m instanceof THREE.Mesh&&m.material instanceof THREE.MeshStandardMaterial){const mat=m.material.clone();mat.transparent=true;mat.opacity=.82;mat.depthWrite=false;mat.emissive=new THREE.Color('#7fe6d6');mat.emissiveMap=mat.map;m.material=mat}});return o},[gltf])
 useFrame(({clock})=>{
  const s=useForestStore.getState(),glow=s.timeOfDay==='night'?1.1:s.timeOfDay==='dusk'?.35:.05
  group.current?.traverse(m=>{if(m instanceof THREE.Mesh&&m.material instanceof THREE.MeshStandardMaterial)m.material.emissiveIntensity+=(glow-m.material.emissiveIntensity)*.05})
  if(group.current&&!stillMotion()){const t=clock.elapsedTime;group.current.position.y=jellyfishSpot.y+Math.sin(t*.8)*.05;group.current.rotation.y=t*.12}
  const g=jellyGlow.value;g.y=group.current?.position.y??jellyfishSpot.y;g.w+=(glow-g.w)*.05
 })
 return <group ref={group} name="secret-jellyfish" position={[jellyfishSpot.x,jellyfishSpot.y,jellyfishSpot.z]}><primitive object={object}/></group>
}

/** A raccoon's mark knife-cut into timber: a paw, a heart and the year, as dark grooves with a pale lit edge. */
function carvingTexture(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=160
 const g=canvas.getContext('2d')
 if(g){
  const cut=(draw:()=>void)=>{
   g.save();g.translate(1.5,2);g.strokeStyle='rgba(236,196,140,.55)';g.fillStyle='rgba(236,196,140,.55)';draw();g.restore()
   g.strokeStyle='#3b2414';g.fillStyle='#3b2414';draw()
  }
  g.lineWidth=6;g.lineCap='round';g.lineJoin='round'
  cut(()=>{
   g.beginPath();g.ellipse(64,86,20,17,0,0,Math.PI*2);g.fill()
   for(const [x,y] of [[38,58],[56,46],[76,46],[92,58]]){g.beginPath();g.ellipse(x,y,8,10,0,0,Math.PI*2);g.fill()}
  })
  cut(()=>{
   g.beginPath();g.moveTo(178,108);g.bezierCurveTo(128,74,140,30,170,40);g.bezierCurveTo(178,43,178,52,178,56)
   g.bezierCurveTo(178,52,178,43,186,40);g.bezierCurveTo(216,30,228,74,178,108);g.stroke()
  })
  cut(()=>{g.font='bold 30px Georgia, serif';g.textAlign='center';g.fillText('2026',128,148)})
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4
 return texture
}

/**
 * The carving sits on the first piece of the lookout behind the platform view (looking back toward the stairs):
 * found once the tower has loaded by casting from the eye, so it lands on the real timber wherever that is.
 */
function Carving(){
 const decal=useRef<THREE.Mesh>(null),placed=useRef(false),tries=useRef(0)
 const texture=useMemo(()=>carvingTexture(),[])
 useEffect(()=>()=>texture.dispose(),[texture])
 // Tried each frame until it lands: the tower can report ready a frame before its world matrices settle.
 useFrame(({scene})=>{
  const tower=scene.getObjectByName('asset-lookout'),mesh=decal.current
  if(placed.current||tries.current>120||!useForestStore.getState().lookoutReady||!tower||!mesh)return
  tries.current++
  tower.updateWorldMatrix(true,true)
  const eye=new THREE.Vector3(lookoutEye.x,lookoutEye.y,lookoutEye.z),ray=new THREE.Raycaster(),back=initialLookoutView.yaw+Math.PI
  for(const pitch of [-.3,-.45,-.2,-.6])for(let k=0;k<16;k++){
   const yaw=back+(k%2?1:-1)*Math.ceil(k/2)*.2,dir=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch))
   ray.set(eye,dir);ray.near=.4;ray.far=2.4
   const hit=ray.intersectObject(tower,true).find(h=>h.face)
   if(!hit?.face)continue
   const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
   if(normal.dot(dir)>0)normal.negate()
   if(Math.abs(normal.y)>.45)continue
   mesh.position.copy(hit.point).addScaledVector(normal,.012)
   mesh.lookAt(hit.point.clone().add(normal));mesh.visible=true;placed.current=true
   return
  }
 })
 return <mesh ref={decal} name="secret-carving" visible={false}>
  <planeGeometry args={[.22,.14]}/>
  <meshStandardMaterial map={texture} transparent roughness={.95} polygonOffset polygonOffsetFactor={-2} depthWrite={false}/>
 </mesh>
}

/** A copy of a Lux3D model (X5) that casts and takes shadows. */
function useModel(url:string){
 const gltf=useGLTF(url)
 return useMemo(()=>{const o=gltf.scene.clone(true);o.traverse(m=>{if(m instanceof THREE.Mesh){m.castShadow=true;m.receiveShadow=true}});return o},[gltf])
}

/** The heart stone (Lux3D): a thin weathered slab, heart-shaped face on and plain from the trail. */
function HeartStone(){
 const object=useModel('/assets/x5/heart-stone.glb')
 return <group name="secret-heart-stone" position={[heartStone.x,groundHeightAt(heartStone.x,heartStone.z)-.04,heartStone.z]} rotation={[0,Math.atan2(heartStone.normal.x,heartStone.normal.z),0]}>
  <primitive object={object}/>
 </group>
}

/** Dug earth fading to dark at the back of the hole: a half disc whose centre is darkest, painted once. */
function denMouthTexture(){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64
 const g=canvas.getContext('2d')
 if(g){
  const shade=g.createRadialGradient(64,64,4,64,64,64)
  shade.addColorStop(0,'#050302');shade.addColorStop(.6,'#0d0805');shade.addColorStop(.9,'rgba(40,26,14,.6)');shade.addColorStop(1,'rgba(40,26,14,0)')
  g.fillStyle=shade;g.fillRect(0,0,128,64)
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
 return texture
}

/**
 * The fox den (Lux3D mound sunk into the bank): by day the fox sleeps curled on the dug earth in front, breathing;
 * at dusk it peeks out of the mouth; at night only its eyes shine in the dark. The hole is shallow in the model, so a
 * shaded half disc deepens it.
 */
function FoxDen(){
 const den=useModel('/assets/x5/fox-den-entrance.glb'),sleeper=useModel('/assets/x5/sleeping-fox.glb'),peeker=useModel('/assets/x5/peeking-fox.glb')
 const eyes=useRef<THREE.Group>(null),sleeping=useRef<THREE.Group>(null),peeking=useRef<THREE.Group>(null)
 const mouth=useMemo(()=>denMouthTexture(),[])
 useEffect(()=>()=>mouth.dispose(),[mouth])
 const baseY=terrainHeight(foxDen.x,foxDen.z)-.12,sleepY=terrainHeight(foxDen.sleep.x,foxDen.sleep.z)-.05
 useFrame(({clock})=>{
  const light=useForestStore.getState().timeOfDay,t=clock.elapsedTime
  if(sleeping.current){sleeping.current.visible=light==='day';if(!stillMotion())sleeping.current.scale.set(1,1+Math.sin(t*1.6)*.025,1+Math.sin(t*1.6)*.012)}
  if(peeking.current)peeking.current.visible=light==='dusk'
  // At night the fox stays in, blinking now and then.
  if(eyes.current)eyes.current.visible=light==='night'&&(stillMotion()||(t%4.3)>.18)
 })
 return <group name="secret-fox-den">
  <group position={[foxDen.x,baseY,foxDen.z]} rotation={[foxDen.tilt,0,0]}>
   <primitive object={den}/>
   <mesh position={[.06,.04,.36]} scale={[1,1.25,1]}><circleGeometry args={[.22,24,0,Math.PI]}/><meshBasicMaterial map={mouth} transparent depthWrite={false}/></mesh>
   <group ref={eyes} position={[.06,.15,.38]}>
    {[-.05,.05].map(x=><mesh key={x} position={[x,0,0]} renderOrder={3}><sphereGeometry args={[.018,8,6]}/><meshBasicMaterial color="#ffd27a" toneMapped={false}/></mesh>)}
   </group>
   <group ref={peeking} position={[.06,-.02,.34]} rotation={[-foxDen.tilt,0,0]}><primitive object={peeker}/></group>
  </group>
  <group ref={sleeping} position={[foxDen.sleep.x,sleepY,foxDen.sleep.z]} rotation={[.3,.5,0]}><primitive object={sleeper}/></group>
 </group>
}

export function Secrets(){
 return <>
  <Suspense fallback={null}><Bottle/><Jellyfish/><HeartStone/><FoxDen/></Suspense>
  <Carving/>
 </>
}
