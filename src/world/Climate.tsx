import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {usePhotoStore} from '../game/photoStore'
import {climateLook,seasonFor,weatherFor} from '../game/weather'
import {climateNow,climateUniforms} from './climateUniforms'
import {groundHeightAt} from '../game/movement'
import {pond,seaLevel} from './worldConfig'

const STREAKS=900,LEAVES=180,SPLASHES=240,BOX=16,HEIGHT=11,SPLASH_RADIUS=11
// A fixed scatter (not Math.random): the same streaks and leaves on every render.
const hash=(i:number,k:number)=>{const v=Math.sin(i*12.9898+k*78.233)*43758.5453;return v-Math.floor(v)}

/** A raindrop landing on the ground: a flat ring squashed to the viewing angle, with a bright fleck at first. */
const splashShader={
 vertex:/* glsl */`attribute float age;uniform float pixels;varying float vAge;
  void main(){vAge=age;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=pixels*(.06+.22*age)/max(-mv.z,.1);}`,
 fragment:/* glsl */`uniform float opacity;uniform float squash;varying float vAge;
  void main(){
   vec2 c=(gl_PointCoord-.5)*2.0;c.y/=squash;float r=length(c);if(r>1.0||vAge<0.0)discard;
   float ring=1.0-smoothstep(.0,.16,abs(r-.25-.7*vAge));
   float fleck=(1.0-smoothstep(.0,.3,r))*(1.0-smoothstep(.0,.25,vAge));
   gl_FragColor=vec4(vec3(.86,.9,.92),(ring*.5+fleck*.8)*(1.0-vAge)*opacity);
  }`,
}

/** The day's weather and season, or the photo preview of another; eased so a change never snaps. */
function target(){
 const s=useForestStore.getState(),p=usePhotoStore.getState(),day=s.homeBook.nights
 return climateLook(p.active&&p.weatherPreview?p.weatherPreview:weatherFor(day),p.active&&p.seasonPreview?p.seasonPreview:seasonFor(day))
}

/**
 * Weather and season in the scene (plan X4): eases the shared shader inputs and sky numbers toward today's look,
 * and draws rain streaks and autumn leaves around the camera. Indoors, and with reduced motion, nothing falls.
 */
export function Climate(){
 const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)'),[])
 const rain=useMemo(()=>{
  const g=new THREE.BufferGeometry(),pos=new Float32Array(STREAKS*6),seed=new Float32Array(STREAKS*3)
  for(let i=0;i<STREAKS;i++){seed[i*3]=hash(i,1);seed[i*3+1]=hash(i,2);seed[i*3+2]=hash(i,3)}
  g.setAttribute('position',new THREE.BufferAttribute(pos,3))
  const m=new THREE.LineBasicMaterial({color:'#d6e0e4',transparent:true,opacity:0,depthWrite:false})
  const lines=new THREE.LineSegments(g,m);lines.frustumCulled=false;lines.name='rain'
  return{lines,pos,seed,material:m}
 },[])
 const leaves=useMemo(()=>{
  const g=new THREE.BufferGeometry(),pos=new Float32Array(LEAVES*3),seed=new Float32Array(LEAVES*3),col=new Float32Array(LEAVES*3)
  const tones=[new THREE.Color('#c9772e'),new THREE.Color('#d9a441'),new THREE.Color('#a8502a')]
  for(let i=0;i<LEAVES;i++){seed[i*3]=hash(i,4);seed[i*3+1]=hash(i,5);seed[i*3+2]=hash(i,6);tones[i%3].toArray(col,i*3)}
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3))
  const m=new THREE.PointsMaterial({size:.09,vertexColors:true,transparent:true,opacity:0,depthWrite:false})
  const points=new THREE.Points(g,m);points.frustumCulled=false;points.name='falling-leaves'
  return{points,pos,seed,material:m}
 },[])
 const splashes=useMemo(()=>{
  const g=new THREE.BufferGeometry(),pos=new Float32Array(SPLASHES*3),age=new Float32Array(SPLASHES).fill(-1)
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('age',new THREE.BufferAttribute(age,1))
  const m=new THREE.ShaderMaterial({vertexShader:splashShader.vertex,fragmentShader:splashShader.fragment,transparent:true,depthWrite:false,
   uniforms:{opacity:{value:0},squash:{value:.4},pixels:{value:900}}})
  const points=new THREE.Points(g,m);points.frustumCulled=false;points.name='rain-splashes'
  return{points,pos,age,cycle:new Float32Array(SPLASHES).fill(-1),material:m}
 },[])
 const clock=useRef(0)
 // The frame loop works on refs to the built objects (as FishingScene does), not on the memoised values.
 const live=useRef({rain,leaves,splashes})
 useEffect(()=>{live.current={rain,leaves,splashes}},[rain,leaves,splashes])
 useFrame(({camera,size},delta)=>{
  const {rain,leaves,splashes}=live.current
  const dt=Math.min(delta,.05),k=1-Math.exp(-dt*.8),look=target(),s=useForestStore.getState()
  const ease=(v:number,to:number)=>v+(to-v)*k
  climateNow.overcast=ease(climateNow.overcast,look.overcast);climateNow.light=ease(climateNow.light,look.light)
  climateNow.fog=ease(climateNow.fog,look.fog);climateNow.rain=ease(climateNow.rain,look.rain);climateNow.leaves=ease(climateNow.leaves,look.leaves)
  climateNow.fireflies=ease(climateNow.fireflies,look.fireflies);climateNow.butterflies=ease(climateNow.butterflies,look.butterflies)
  climateUniforms.climateBloom.value=ease(climateUniforms.climateBloom.value,look.bloom)
  climateUniforms.climateLitter.value=ease(climateUniforms.climateLitter.value,look.litter)
  climateUniforms.climateTurn.value=ease(climateUniforms.climateTurn.value,look.turn)
  climateUniforms.climateWet.value=ease(climateUniforms.climateWet.value,look.wet)
  climateUniforms.climateRain.value=climateNow.rain
  climateUniforms.climateBroadleaf.value.lerp(new THREE.Vector3(...look.broadleaf),k)
  climateUniforms.climatePine.value.lerp(new THREE.Vector3(...look.pine),k)
  climateUniforms.climateGrass.value.lerp(new THREE.Vector3(...look.grass),k)
  const outside=s.location==='island'&&s.mode!=='sleeping',moving=!reduced.matches
  if(moving)clock.current+=dt
  const t=clock.current,cx=camera.position.x,cy=camera.position.y,cz=camera.position.z
  climateUniforms.climateTime.value=t
  // Rain: short slanted streaks falling through a box that travels with the camera.
  rain.material.opacity=outside&&moving?.38*climateNow.rain:0
  rain.lines.visible=rain.material.opacity>.01
  if(rain.lines.visible){
   const count=Math.round(STREAKS*Math.min(1,climateNow.rain*1.1))
   for(let i=0;i<STREAKS;i++){
    const o=i*6,a=rain.seed[i*3],b=rain.seed[i*3+1],c=rain.seed[i*3+2]
    if(i>=count){rain.pos.fill(0,o,o+6);continue}
    const x=cx+(a-.5)*BOX*2,z=cz+(b-.5)*BOX*2,y=cy+HEIGHT/2-(((c*HEIGHT+t*9)%HEIGHT))
    rain.pos[o]=x;rain.pos[o+1]=y;rain.pos[o+2]=z;rain.pos[o+3]=x+.06;rain.pos[o+4]=y-.42;rain.pos[o+5]=z+.03
   }
   rain.lines.geometry.attributes.position.needsUpdate=true
  }
  // Splashes where drops meet the ground near the player; each lands somewhere new every cycle.
  splashes.material.opacity=outside&&moving?climateNow.rain:0
  splashes.material.uniforms.opacity.value=splashes.material.opacity
  splashes.points.visible=splashes.material.opacity>.01
  if(splashes.points.visible){
   const p=s.position,count=Math.round(SPLASHES*climateNow.rain),look=camera.getWorldDirection(new THREE.Vector3())
   splashes.material.uniforms.squash.value=Math.max(.22,Math.min(1,Math.abs(look.y)*1.2))
   splashes.material.uniforms.pixels.value=size.height*.9
   for(let i=0;i<SPLASHES;i++){
    if(i>=count){splashes.age[i]=-1;continue}
    const phase=t*1.6+hash(i,7),cycle=Math.floor(phase)
    if(cycle!==splashes.cycle[i]){
     splashes.cycle[i]=cycle
     const a=hash(i,cycle*.37+1)*Math.PI*2,r=Math.sqrt(hash(i,cycle*.53+2))*SPLASH_RADIUS,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,y=groundHeightAt(x,z)
     // Open water has its own rings; drops there make no ground splash.
     const water=y<seaLevel+.05||Math.hypot(x-pond.x,z-pond.z)<pond.radius
     splashes.pos[i*3]=x;splashes.pos[i*3+1]=water?-99:y+.03;splashes.pos[i*3+2]=z
    }
    splashes.age[i]=phase-cycle
   }
   splashes.points.geometry.attributes.position.needsUpdate=true;splashes.points.geometry.attributes.age.needsUpdate=true
  }
  // Autumn leaves drift down around the player with a gentle sway.
  leaves.material.opacity=outside&&moving?.9*climateNow.leaves:0
  leaves.points.visible=leaves.material.opacity>.01
  if(leaves.points.visible){
   const p=s.position
   for(let i=0;i<LEAVES;i++){
    const a=leaves.seed[i*3],b=leaves.seed[i*3+1],c=leaves.seed[i*3+2]
    const x=p.x+(a-.5)*22+Math.sin(t*.9+i)*.5,z=p.z+(b-.5)*22+Math.cos(t*.7+i*1.3)*.5
    const ground=groundHeightAt(x,z),y=ground+.1+((c*6-t*.55)%6+6)%6
    leaves.pos[i*3]=x;leaves.pos[i*3+1]=y;leaves.pos[i*3+2]=z
   }
   leaves.points.geometry.attributes.position.needsUpdate=true
  }
 })
 return <><primitive object={rain.lines}/><primitive object={splashes.points}/><primitive object={leaves.points}/></>
}
