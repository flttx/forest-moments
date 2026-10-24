import {useMemo,useEffect,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {useForestStore} from '../game/store'
import {seaBoundaryClearance} from '../game/rowing'
import {seaLevel,seaRangeRadius} from './worldConfig'

/** A quiet foam-like limit appears only as the boat approaches the offshore edge. */
export function OceanBoundary(){
  const field=useMemo(()=>{
    const positions:number[]=[],uvs:number[]=[],indices:number[]=[]
    for(let i=0;i<=192;i++){
      const a=i*Math.PI*2/192,r=seaRangeRadius(a)
      for(const width of [-.13,.13]){positions.push(Math.cos(a)*(r+width),seaLevel+.012,Math.sin(a)*(r+width));uvs.push(i/192,width<0?0:1)}
      if(i<192){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2)}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices)
    const material=new THREE.MeshBasicMaterial({color:'#b4cfc2',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})
    const mesh=new THREE.Mesh(geometry,material);mesh.name='offshore-boundary';mesh.visible=false
    return {geometry,material,mesh}
  },[])
  const runtime=useRef(field)
  useFrame((_,dt)=>{
    const f=runtime.current,{boat,mode}=useForestStore.getState()
    const target=mode==='rowing'?.3*(1-THREE.MathUtils.smoothstep(seaBoundaryClearance(boat.x,boat.z),.4,3)):0
    f.material.opacity=THREE.MathUtils.damp(f.material.opacity,target,5,Math.min(dt,.05));f.mesh.visible=f.material.opacity>.005
  })
  useEffect(()=>()=>{field.geometry.dispose();field.material.dispose()},[field])
  return <primitive object={field.mesh}/>
}
