import {useEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {usePhotoStore} from '../game/photoStore'
import {climateLook,seasonFor,weatherFor} from '../game/weather'
import {climateNow,climateUniforms} from './climateUniforms'
import {groundHeightAt} from '../game/movement'

const STREAKS=900,LEAVES=140,BOX=16,HEIGHT=11
// A fixed scatter (not Math.random): the same streaks and leaves on every render.
const hash=(i:number,k:number)=>{const v=Math.sin(i*12.9898+k*78.233)*43758.5453;return v-Math.floor(v)}

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
 const clock=useRef(0)
 // The frame loop works on refs to the built objects (as FishingScene does), not on the memoised values.
 const live=useRef({rain,leaves})
 useEffect(()=>{live.current={rain,leaves}},[rain,leaves])
 useFrame(({camera},delta)=>{
  const {rain,leaves}=live.current
  const dt=Math.min(delta,.05),k=1-Math.exp(-dt*.8),look=target(),s=useForestStore.getState()
  const ease=(v:number,to:number)=>v+(to-v)*k
  climateNow.overcast=ease(climateNow.overcast,look.overcast);climateNow.light=ease(climateNow.light,look.light)
  climateNow.fog=ease(climateNow.fog,look.fog);climateNow.rain=ease(climateNow.rain,look.rain);climateNow.leaves=ease(climateNow.leaves,look.leaves)
  climateUniforms.climateWet.value=ease(climateUniforms.climateWet.value,look.wet)
  climateUniforms.climateBroadleaf.value.lerp(new THREE.Vector3(...look.broadleaf),k)
  climateUniforms.climatePine.value.lerp(new THREE.Vector3(...look.pine),k)
  climateUniforms.climateGrass.value.lerp(new THREE.Vector3(...look.grass),k)
  const outside=s.location==='island'&&s.mode!=='sleeping',moving=!reduced.matches
  if(moving)clock.current+=dt
  const t=clock.current,cx=camera.position.x,cy=camera.position.y,cz=camera.position.z
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
 return <><primitive object={rain.lines}/><primitive object={leaves.points}/></>
}
