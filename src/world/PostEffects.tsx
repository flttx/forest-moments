import {useState} from 'react'
import {PerformanceMonitor} from '@react-three/drei'
import {Bloom,EffectComposer,N8AO,ToneMapping,Vignette} from '@react-three/postprocessing'
import {ToneMappingMode} from 'postprocessing'

/** Bloom only picks up HDR emitters (lantern panes, windows, fire, sun disc); sunlit sand stays below the threshold. */
export const bloomThreshold=2
const forcedLow=new URLSearchParams(location.search).get('quality')==='low'

/**
 * Contact shading, emitter glow and a light vignette. The composer disables renderer tone mapping,
 * so ACES is applied here once for sky, fog and lit surfaces alike.
 */
export function PostEffects(){
  const [low,setLow]=useState(forcedLow)
  return <>
    <PerformanceMonitor onDecline={()=>setLow(true)}/>
    <EffectComposer multisampling={low?0:4}>
      <N8AO enabled={!low} halfRes aoRadius={1.6} distanceFalloff={.6} intensity={2.2} aoSamples={12} denoiseSamples={4} denoiseRadius={10}/>
      <Bloom mipmapBlur luminanceThreshold={bloomThreshold} luminanceSmoothing={.25} intensity={.7} radius={.72}/>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC}/>
      <Vignette offset={.32} darkness={.42}/>
    </EffectComposer>
  </>
}
