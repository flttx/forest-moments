import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {Group,Mesh,MeshBasicMaterial,Vector3} from 'three'
import type {RefObject} from 'react'
import {useForestStore} from '../game/store'
import {isNavigableSea} from '../game/rowing'
import {isDockSurface,seaLevel} from './worldConfig'

type Ripple={x:number;z:number;age:number;life:number;size:number;heading:number;kind:'wake'|'paddle'}
const capacity=28
function waterPatch(x:number,z:number,radius:number){
 return [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>!isDockSurface(x+dx,z+dz)&&isNavigableSea(x+dx,z+dz))
}
/** Finite pool of world-space marks. Marks do not travel or rotate with the hull. */
export function BoatWaterFeedback({blade,reducedMotion}:{blade:Mesh;reducedMotion:RefObject<boolean>}){
 const root=useRef<Group>(null)
 const state=useRef({cursor:0,wakeDistance:0,paddleCooldown:0,lastX:NaN,lastZ:NaN,emittedWake:0,emittedPaddle:0})
 const pool=useRef<Ripple[]>(Array.from({length:capacity},()=>({x:0,z:0,age:99,life:1,size:1,heading:0,kind:'wake'})))
 const samples=useMemo(()=>{
  const vertices=blade.geometry.getAttribute('position'),points:Vector3[]=[]
  for(let i=0;i<vertices.count;i+=Math.max(1,Math.floor(vertices.count/128)))points.push(new Vector3().fromBufferAttribute(vertices,i))
  return points
 },[blade])
 const point=useMemo(()=>new Vector3(),[])
 useFrame((_,delta)=>{
  if(!root.current)return
  const dt=Math.min(delta,.05),s=state.current,ripples=pool.current,{boat,mode,boatTransfer}=useForestStore.getState()
  const distance=Number.isFinite(s.lastX)?Math.hypot(boat.x-s.lastX,boat.z-s.lastZ):0
  s.lastX=boat.x;s.lastZ=boat.z;s.paddleCooldown=Math.max(0,s.paddleCooldown-dt)
  const emit=(x:number,z:number,kind:Ripple['kind'])=>{
   const size=kind==='paddle'?.48:.8
   if(!waterPatch(x,z,size))return
   Object.assign(ripples[s.cursor],{x,z,age:0,life:kind==='paddle'?1.6:2.4,size,heading:boat.heading,kind})
   s.cursor=(s.cursor+1)%capacity
   if(kind==='paddle')s.emittedPaddle++;else s.emittedWake++
  }
  if(reducedMotion.current){for(const r of ripples)r.age=r.life;s.wakeDistance=0}
  else if(mode==='rowing'&&!boatTransfer){
   s.wakeDistance+=distance
   if(s.wakeDistance>.28&&Math.abs(boat.speed)>.1){
    const direction=boat.speed<0?-1:1
    emit(boat.x-Math.cos(boat.heading)*1.65*direction,boat.z+Math.sin(boat.heading)*1.65*direction,'wake')
    s.wakeDistance=0
   }
   if(boat.effort>.08&&s.paddleCooldown===0){
    blade.updateWorldMatrix(true,false)
    let low=Infinity,x=0,z=0
    for(const sample of samples){point.copy(sample).applyMatrix4(blade.matrixWorld);if(point.y<low){low=point.y;x=point.x;z=point.z}}
    if(low<seaLevel+.015){emit(x,z,'paddle');s.paddleCooldown=.22}
   }
  }else s.wakeDistance=0
  ripples.forEach((r,i)=>{
   r.age+=dt
   const mesh=root.current!.children[i] as Mesh
   mesh.visible=r.age<r.life&&!reducedMotion.current
   if(!mesh.visible)return
   const u=r.age/r.life,scale=r.size*(.25+.75*u)
   mesh.position.set(r.x,seaLevel+.012,r.z)
   mesh.rotation.set(-Math.PI/2,0,r.heading)
   mesh.scale.set(scale,r.kind==='wake'?scale*.62:scale,1)
   ;(mesh.material as MeshBasicMaterial).opacity=.25*Math.min(1,u*5)*(1-u)*(1-u)
  })
  if(import.meta.env.DEV)root.current.userData.qa={capacity,active:ripples.filter(r=>r.age<r.life).length,emittedWake:s.emittedWake,emittedPaddle:s.emittedPaddle,reducedMotion:reducedMotion.current,marks:ripples.filter(r=>r.age<r.life).map(r=>({x:r.x,z:r.z,age:r.age,kind:r.kind}))}
 },0)
 return <group ref={root} name="boat-water-feedback">
  {Array.from({length:capacity},(_,i)=><mesh key={i} visible={false} renderOrder={1}><ringGeometry args={[.92,1,40]}/><meshBasicMaterial color="#c3d9c6" transparent opacity={0} depthWrite={false}/></mesh>)}
 </group>
}
