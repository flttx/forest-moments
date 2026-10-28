import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {usePhotoStore} from '../game/photoStore'
import {rainbowFor} from '../game/weather'
import {daylightAt} from '../game/dayCycle'
import {dayLighting} from './dayLighting'
import {climateNow} from './climateUniforms'
import {seaLevel} from './worldConfig'
import {rainbowCentre,rainbowRadius,rainbowWidth} from './rainbowArc'

const shader={
 vertex:/* glsl */`varying vec2 vLocal;void main(){vLocal=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragment:/* glsl */`uniform float opacity;uniform float inner;uniform float outer;varying vec2 vLocal;
  vec3 hue(float h){return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);}
  void main(){
   float t=clamp((length(vLocal)-inner)/(outer-inner),0.0,1.0);
   // Red on the outside, violet inside; soft at both edges and fading into the sea haze at the feet.
   float band=pow(sin(3.14159*t),.8),feet=smoothstep(0.0,outer*.22,vLocal.y);
   gl_FragColor=vec4(hue((1.0-t)*.78)*band,band*feet*opacity);
  }`,
}

/**
 * The rainbow the morning after rain (docs/GAMEPLAY_TIER1_PLAN.md T1): a soft additive arc on the sky opposite the
 * sun. Only by day, outdoors; a photo preview of another weather puts it away.
 */
export function Rainbow(){
 const mesh=useRef<THREE.Mesh>(null)
 const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:shader.vertex,fragmentShader:shader.fragment,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,
  uniforms:{opacity:{value:0},inner:{value:rainbowRadius-rainbowWidth/2},outer:{value:rainbowRadius+rainbowWidth/2}}}),[])
 const geometry=useMemo(()=>new THREE.RingGeometry(rainbowRadius-rainbowWidth/2,rainbowRadius+rainbowWidth/2,128,1,0,Math.PI),[])
 useFrame((_,delta)=>{
  const m=mesh.current;if(!m)return
  const s=useForestStore.getState(),p=usePhotoStore.getState()
  const preview=p.active&&(p.weatherPreview||p.seasonPreview)
  const shown=rainbowFor(s.homeBook.nights)&&s.timeOfDay==='day'&&s.mode!=='sleeping'&&!preview
  const u=(m.material as THREE.ShaderMaterial).uniforms.opacity,to=shown?.42*(1-.45*climateNow.overcast):0
  u.value+=(to-u.value)*(1-Math.exp(-Math.min(delta,.05)*1.2))
  m.visible=u.value>.004
  if(!m.visible)return
  const sun=dayLighting(daylightAt(s),s.sunRising).sunPosition.clone().normalize()
  m.position.copy(rainbowCentre(sun));m.lookAt(0,seaLevel,0)
  m.userData.opacity=u.value
 })
 return <mesh ref={mesh} name="rainbow" geometry={geometry} material={material} renderOrder={-90} frustumCulled={false} visible={false}/>
}
