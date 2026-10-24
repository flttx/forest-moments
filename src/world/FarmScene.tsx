import {useEffect,useMemo,useRef} from 'react'
import {useGLTF} from '@react-three/drei'
import {useFrame} from '@react-three/fiber'
import {AnimationMixer,Box3,Group,Mesh,MeshStandardMaterial,Quaternion,Vector3} from 'three'
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js'
import {createAnimals,stepAnimal,animalObstacles} from '../game/farm'
import {useForestStore} from '../game/store'

export function FarmScene(){
 const assets=useGLTF(['/assets/models/farm-ranch.glb','/assets/models/farm-hen.glb','/assets/models/farm-sheep.glb'],true,true)
 const root=useRef<Group>(null),grain=useRef<Group>(null)
 const scene=useMemo(()=>{
  const ranch=assets[0].scene.clone(true)
  ranch.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true}})
  const fill=ranch.getObjectByName('Ranch_Trough_Fill') as Mesh
  const fillBase=fill?{y:fill.position.y,scale:fill.scale.y,bottom:new Box3().setFromObject(fill).min.y}:null
  if(fill)fill.visible=false
  const animals=createAnimals().map((state,i)=>{
   const model=clone(assets[i+1].scene)
   model.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}})
   const mixer=new AnimationMixer(model),actions=Object.fromEntries(assets[i+1].animations.map(c=>[c.name,mixer.clipAction(c)]))
   actions.idle.play()
   const pose=['Body','Neck','Head'].map((name,j)=>{
    const bone=model.getObjectByName(name)!
    const angle=(state.id==='hen'?[-.22,-.30,-.10]:[0,-1.38,.40])[j]
    return{bone,rest:bone.quaternion.clone(),target:bone.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),angle))}
   })
   return{state,model,mixer,actions,pose,poseWeight:0,clip:'idle'}
  })
  return{ranch,fill,fillBase,animals,meal:false}
 },[assets])
 const runtime=useRef(scene)
 useEffect(()=>{
  scene.animals.forEach(a=>a.actions[a.clip].play())
  useForestStore.setState({farmReady:true})
  return()=>{useForestStore.setState({farmReady:false});scene.animals.forEach(a=>{a.mixer.stopAllAction()})}
 },[scene])
 const seeds=useMemo(()=>Array.from({length:36},(_,i)=>{const hen=i<18,k=i%18,a=k*2.399,r=.025+.012*(k%5);return new Vector3((hen?9.23:9.75)+Math.sin(a)*r,.25,(hen?3.95:4.0)+Math.cos(a)*r)}),[])
 useFrame(({scene:world},delta)=>{
  const scene=runtime.current
  const s=useForestStore.getState(),dt=Math.min(delta,.05)
  if(s.mealActive&&!scene.meal)scene.animals.forEach(a=>{a.state.eaten=0})
  scene.meal=s.mealActive
  for(const [i,a] of scene.animals.entries()){
   a.state=stepAnimal(a.state,dt,s.mealActive,s.position)
   const clip=a.state.state==='eat'?(a.state.id==='hen'?'peck':'graze'):a.state.state
   if(a.clip!==clip){a.actions[a.clip]?.fadeOut(.25);a.actions[clip]?.reset().fadeIn(.25).play();a.clip=clip}
   a.mixer.update(dt)
   a.poseWeight+=(Number(a.state.state==='eat')-a.poseWeight)*(1-Math.exp(-12*dt))
   if(a.poseWeight>.001){
    // Blender mouth-vertex fit to the existing 24.5 cm trough; preserve the source walk/sit clips.
    const bite=.96+.04*Math.cos(a.state.eaten*(a.state.id==='hen'?9:5))
    for(const p of a.pose)p.bone.quaternion.slerp(p.rest.clone().slerp(p.target,bite),a.poseWeight)
   }
   a.model.position.set(a.state.x,0,a.state.z);a.model.rotation.y=a.state.yaw
   animalObstacles[i].x=a.state.x;animalObstacles[i].z=a.state.z
  }
  const progress=scene.animals.reduce((n,a)=>n+a.state.eaten/10,0)
  if(s.mealActive&&Math.floor(progress*20)!==Math.floor(s.mealProgress*20))useForestStore.setState({mealProgress:progress})
  if(scene.fill&&scene.fillBase){const f=Math.max(.02,1-progress);scene.fill.visible=s.mealActive;scene.fill.scale.y=scene.fillBase.scale*f;scene.fill.position.y=scene.fillBase.bottom+(scene.fillBase.y-scene.fillBase.bottom)*f}
  if(grain.current)grain.current.children.forEach((o,i)=>{
   if(s.mode==='feeding'){
    const t=Math.min(1,Math.max(0,(s.feedingElapsed-.65-(i%6)*.07)/.42))
    o.visible=t>0
    if(t>0&&!o.userData.launch){
     const actor=world.getObjectByName('asset-raccoon')
     const hand=actor?.getObjectByName('mixamorigRightHand')??actor?.getObjectByName('mixamorig:RightHand')
     hand?.updateWorldMatrix(true,false)
     o.userData.launch=hand?.getWorldPosition(new Vector3())??new Vector3(s.position.x,.8,s.position.z)
    }
    if(o.userData.launch){o.position.copy(o.userData.launch).lerp(seeds[i],t);o.position.y+=.18*Math.sin(Math.PI*t)}
   }else{
    o.userData.launch=null;o.position.copy(seeds[i])
    o.visible=s.mealActive&&(i%18)<Math.ceil(18*(1-scene.animals[i<18?0:1].state.eaten/5))
   }
  })
  if(s.mealActive&&progress>=1)s.finishMeal()
  if(import.meta.env.DEV&&root.current)root.current.userData.qa={animals:scene.animals.map(a=>({...a.state,clip:a.clip,clipTime:a.actions[a.clip]?.time})),foodVisible:s.mealActive&&progress<1,visibleGrains:grain.current?.children.filter(o=>o.visible).length,grainPositions:grain.current?.children.slice(0,2).map(o=>o.position.toArray()),progress}
 })

 const material=useMemo(()=>new MeshStandardMaterial({color:'#cfb76f',roughness:1}),[])
 useEffect(()=>()=>material.dispose(),[material])
 return <group name="forest-farm" ref={root}>
  <group position={[8,0,6]}><primitive object={scene.ranch} dispose={null}/></group>
  {scene.animals.map(a=><primitive key={a.state.id} object={a.model} dispose={null}/>)}
  <group ref={grain}>{seeds.map((p,i)=><mesh key={i} position={p} rotation={[0,i,0]} material={material}><sphereGeometry args={[.018,5,3]}/></mesh>)}</group>
 </group>
}
