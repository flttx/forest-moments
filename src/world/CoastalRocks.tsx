import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { coastRadius, terrainHeight } from './terrain'
export function CoastalRocks() {
  const group=useMemo(()=>{
    const root=new THREE.Group(),matrix=new THREE.Object3D(),colour=new THREE.Color()
    const rng={seed:72};const random=()=>{rng.seed=rng.seed*16807%2147483647;return rng.seed/2147483647}
    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:'white',roughness:.95}),54)
    for(let i=0;i<54;i++) {
      const angle=i*2.39996,radius=coastRadius(angle)-.45+random()*.8,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius
      const size=.35+random()*.8
      matrix.position.set(x,terrainHeight(x,z)+.25,z);matrix.rotation.set(random()*.4,angle,random()*.3);matrix.scale.set(size, size*(.6+random()*.5),size*(.75+random()*.5));matrix.updateMatrix()
      if(x>20&&Math.abs(z)<8){matrix.scale.setScalar(0);matrix.updateMatrix()}
      rocks.setMatrixAt(i,matrix.matrix);colour.set('#777b6e').lerp(new THREE.Color('#b5ae92'),random()*.7);rocks.setColorAt(i,colour)
    }
    rocks.castShadow=true;rocks.receiveShadow=true;root.add(rocks)
    return root
  },[])
  useEffect(()=>()=>group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();if(o instanceof THREE.InstancedMesh)o.dispose()}}),[group])
  return <primitive object={group} dispose={null}/>
}
