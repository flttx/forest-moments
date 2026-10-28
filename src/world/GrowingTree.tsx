import {useEffect,useMemo,useRef} from 'react'
import {useGLTF} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import {Group,Mesh,MeshStandardMaterial} from 'three'
import {useForestStore} from '../game/store'
import {growthStages,plantingSpots,type PlantedTree} from '../game/growth'
import {terrainHeight} from './terrain'

/** One planted tree: its own copy of the stage's model (meshes and materials stay shared). */
function Planted({tree,models}:{tree:PlantedTree;models:Group[]}){
 const spot=plantingSpots[tree.spot]
 const model=useMemo(()=>models[tree.stage].clone(),[models,tree.stage])
 return <group name={`planted-tree-${tree.spot}`} userData={{stage:tree.stage}} position={[spot.x,terrainHeight(spot.x,spot.z),spot.z]}><primitive object={model} dispose={null}/></group>
}

/** An empty plot: a patch of turned soil with a few pebbles, so the open ground reads as somewhere to plant. */
function Plot({spot}:{spot:number}){
 const p=plantingSpots[spot],y=terrainHeight(p.x,p.z)
 return <group name={`planting-plot-${spot}`} position={[p.x,y,p.z]}>
  <mesh rotation-x={-Math.PI/2} position-y={.012} receiveShadow><circleGeometry args={[.5,24]}/><meshStandardMaterial color="#5a4128" roughness={1} transparent opacity={.85} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>
  {[0,1.3,2.5,3.7,5].map((a,i)=><mesh key={i} position={[Math.cos(a)*.56,.03,Math.sin(a)*.56]} scale={[1,.55,.85]} castShadow><icosahedronGeometry args={[.07+.02*(i%2),0]}/><meshStandardMaterial color="#8d8573" roughness={.95}/></mesh>)}
 </group>
}

export function GrowingTree(){
 const assets=useGLTF(growthStages.map(s=>`/assets/models/tree-${s.id}.glb`),true,true)
 const garden=useForestStore(s=>s.garden)
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
  if(import.meta.env.DEV&&root.current)root.current.userData.stage=garden.trees.find(t=>t.spot===0)?.stage??null
 })
 useFrame((_,dt)=>{if(!reduced.current)time.current.value+=Math.min(dt,.05)})
 return <group ref={root} name="planted-tree">
  {plantingSpots.map((_,spot)=>{const tree=garden.trees.find(t=>t.spot===spot);return tree?<Planted key={spot} tree={tree} models={models}/>:<Plot key={spot} spot={spot}/>})}
 </group>
}
