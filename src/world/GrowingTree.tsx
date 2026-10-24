import {useEffect,useMemo,useRef} from 'react'
import {useGLTF} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import {Group,Mesh,MeshStandardMaterial} from 'three'
import {useForestStore} from '../game/store'
import {growthStages,plantingSpot} from '../game/growth'
import {terrainHeight} from './terrain'

export function GrowingTree(){
 const assets=useGLTF(growthStages.map(s=>`/assets/models/tree-${s.id}.glb`),true,true)
 const tree=useForestStore(s=>s.tree)
 const root=useRef<Group>(null),time=useRef({value:0}),reduced=useRef(false)
 const models=useMemo(()=>assets.map((gltf,index)=>{
  const scene=gltf.scene.clone(true)
  scene.name=`growth-${growthStages[index].id}`
  scene.traverse(o=>{
   if(!(o instanceof Mesh))return
   o.castShadow=true;o.receiveShadow=true
   const patch=(source:MeshStandardMaterial)=>{
    const m=source.clone();m.roughness=.85;m.metalness=0;m.roughnessMap=null;m.metalnessMap=null;m.envMapIntensity=.35
    m.onBeforeCompile=shader=>{
     shader.uniforms.growthWind=time.current
     shader.vertexShader='uniform float growthWind;\n'+shader.vertexShader
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nfloat crown=pow(clamp(position.y/${growthStages[index].height.toFixed(2)},0.0,1.0),2.0);transformed.x+=sin(growthWind*1.3+position.y*2.0)*crown*${(growthStages[index].height*.007).toFixed(4)};`)
    }
    m.customProgramCacheKey=()=>`growth-wind-${index}`
    return m
   }
   o.material=Array.isArray(o.material)?o.material.map(m=>patch(m as MeshStandardMaterial)):patch(o.material as MeshStandardMaterial)
  })
  return scene
 }),[assets])
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>{reduced.current=media.matches}
  change();media.addEventListener('change',change)
  useForestStore.getState().setGrowthReady(true)
  const timer=setInterval(()=>useForestStore.getState().refreshGrowth(),500)
  const refresh=()=>useForestStore.getState().refreshGrowth()
  window.addEventListener('focus',refresh)
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);media.removeEventListener('change',change);useForestStore.getState().setGrowthReady(false)}
 },[])
 useEffect(()=>()=>models.forEach(model=>model.traverse(o=>{if(o instanceof Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())})),[models])
 useFrame(()=>{
  if(import.meta.env.DEV&&root.current)root.current.userData.stage=tree?.stage??null
 })
 useFrame((_,dt)=>{if(!reduced.current)time.current.value+=Math.min(dt,.05)})
 return <group ref={root} name="planted-tree" position={[plantingSpot.x,terrainHeight(plantingSpot.x,plantingSpot.z),plantingSpot.z]}>
  {tree&&<primitive object={models[tree.stage]} dispose={null}/>}
 </group>
}
