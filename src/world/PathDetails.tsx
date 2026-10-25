import {onBridge} from '../game/expansion'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { canStandAt, groundHeightAt, dockDeckHeight } from '../game/movement'
import { groundNoise, pathEdgeDistance } from './terrain'

function makeRandom() {
  let seed=41891
  return ()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
}

/** Low embedded gravel gathers at broken verges; it never forms a raised curb. */
export function PathDetails() {
  const field=useMemo(()=>{
    const random=makeRandom()
    const points:number[][]=[]
    for(let i=0;i<14000;i++) {
      const x=(random()-.5)*68,z=(random()-.5)*68,edge=pathEdgeDistance(x,z)
      if(edge<-.65||edge>.48||onBridge(x,z)||!canStandAt(x,z)||groundHeightAt(x,z)===dockDeckHeight)continue
      if(Math.hypot(x,z)<1||Math.hypot(x-1.5,z+5)<1||Math.hypot(x,z-8)<1.2)continue
      if(random()>.25+.55*groundNoise(x*.9,z*.9))continue
      points.push([x,z,.035+random()*.095,random()*Math.PI,random()])
    }
    const geometry=new THREE.IcosahedronGeometry(1,0)
    const material=new THREE.MeshStandardMaterial({roughness:1})
    const mesh=new THREE.InstancedMesh(geometry,material,points.length)
    mesh.name='path-embedded-gravel';mesh.receiveShadow=true
    const dummy=new THREE.Object3D(),colour=new THREE.Color()
    points.forEach(([x,z,size,yaw,t],i)=>{
      dummy.position.set(x,groundHeightAt(x,z)-.012,z);dummy.rotation.set(.15*t,yaw,.1*t)
      dummy.scale.set(size*(1+t*.6),size*.36,size*(.7+t*.4));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)
      colour.set(t<.35?'#6d624e':t<.7?'#8b7a5e':'#a29479');mesh.setColorAt(i,colour)
    })
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()
    return {mesh,geometry,material}
  },[])
  useEffect(()=>()=>{field.mesh.dispose();field.geometry.dispose();field.material.dispose()},[field])
  return <primitive object={field.mesh} dispose={null}/>
}
