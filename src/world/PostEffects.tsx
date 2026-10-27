import {useEffect,useRef,useState} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {PerformanceMonitor} from '@react-three/drei'
import {Bloom,BrightnessContrast,DepthOfField,EffectComposer,HueSaturation,N8AO,Noise,Sepia,ToneMapping,Vignette} from '@react-three/postprocessing'
import {BlendFunction,ToneMappingMode} from 'postprocessing'
import {usePhotoStore} from '../game/photoStore'
import {filterAllowed,type FilterId} from '../game/photo'

/** Bloom only picks up HDR emitters (lantern panes, windows, fire, sun disc); sunlit sand stays below the threshold. */
export const bloomThreshold=2
const forcedLow=new URLSearchParams(location.search).get('quality')==='low'

/** Photo-mode look; only active while the camera is out and the look is unlocked. */
function useLook(low:boolean):FilterId{
 const active=usePhotoStore(s=>s.active),filter=usePhotoStore(s=>s.filter)
 return active&&filterAllowed(filter,low)?filter:'plain'
}

const isShown=(o:THREE.Object3D)=>{for(let n:THREE.Object3D|null=o;n;n=n.parent)if(!n.visible)return false;return true}

/** Keeps the depth-of-field focus on the raccoon, or a few strides ahead when it is out of frame (boat, tower, hidden). */
function FocusPull({effect}:{effect:React.RefObject<{target:THREE.Vector3}|null>}){
 const point=useRef(new THREE.Vector3()),forward=useRef(new THREE.Vector3())
 useFrame(({scene,camera})=>{
  const target=effect.current?.target;if(!target)return
  const raccoon=scene.getObjectByName('asset-raccoon')
  const visible=!!raccoon&&isShown(raccoon)
  if(raccoon&&visible){raccoon.getWorldPosition(point.current);point.current.y+=.5}
  else point.current.copy(camera.position).addScaledVector(camera.getWorldDirection(forward.current),14)
  target.copy(point.current)
 })
 return null
}

/**
 * Contact shading, emitter glow and a light vignette. The composer disables renderer tone mapping,
 * so ACES is applied here once for sky, fog and lit surfaces alike. Photo looks grade after tone mapping.
 */
export function PostEffects(){
  const [low,setLow]=useState(forcedLow)
  // Photo mode greys out what the low tier cannot draw.
  useEffect(()=>{usePhotoStore.setState({lowQuality:low})},[low])
  const look=useLook(low),focus=useRef<{target:THREE.Vector3}|null>(null)
  const lamp=look==='lamp'
  return <>
    <PerformanceMonitor onDecline={()=>setLow(true)}/>
    {look==='depth'&&<FocusPull effect={focus}/>}
    <EffectComposer multisampling={low?0:4}>
      <N8AO enabled={!low} halfRes aoRadius={1.6} distanceFalloff={.6} intensity={2.2} aoSamples={12} denoiseSamples={4} denoiseRadius={10}/>
      <Bloom mipmapBlur luminanceThreshold={lamp?1.1:bloomThreshold} luminanceSmoothing={.25} intensity={lamp?1.5:.7} radius={lamp?.85:.72}/>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC}/>
      {look==='warm'?<Sepia intensity={.16}/>:<></>}
      {look==='warm'?<BrightnessContrast brightness={.04} contrast={.06}/>:<></>}
      {look==='film'?<Sepia intensity={.28}/>:<></>}
      {look==='film'?<HueSaturation saturation={-.14}/>:<></>}
      {look==='film'?<Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={.55}/>:<></>}
      {look==='mono'?<HueSaturation saturation={-1}/>:<></>}
      {look==='mono'?<BrightnessContrast brightness={.02} contrast={-.04}/>:<></>}
      {look==='depth'?<DepthOfField ref={focus as never} target={[0,0,0]} worldFocusRange={3.2} bokehScale={5}/>:<></>}
      <Vignette offset={look==='film'?.2:.32} darkness={look==='film'?.62:.42}/>
    </EffectComposer>
  </>
}
