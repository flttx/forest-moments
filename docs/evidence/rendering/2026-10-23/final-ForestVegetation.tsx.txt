import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { canStandAt } from '../game/movement'
import { pond } from '../game/rowing'
import { pinePositions } from './assets'
import { coastRadius, pathDistance, terrainHeight } from './terrain'

function seededRandom() {
  let seed=72
  return ()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
}

/** Deterministic, shared geometry: irregular boughs and ground cover stay at four draw calls. */
export function ForestVegetation() {
  const group = useMemo(() => {
    const root = new THREE.Group(), matrix = new THREE.Object3D(), colour = new THREE.Color()
    const random = seededRandom()
    const crown = new THREE.ConeGeometry(1, 1, 12, 5)
    const points = crown.getAttribute('position')
    for (let i=0;i<points.count;i++) {
      const x=points.getX(i),y=points.getY(i),z=points.getZ(i),a=Math.atan2(z,x)
      const swell=1+Math.sin(a*5+y*8)*.13+Math.cos(a*3-y*11)*.09
      points.setXYZ(i,x*swell,y+Math.sin(a*5)*.07*(.5-y),z*swell)
    }
    crown.computeVertexNormals()
    const leaves = new THREE.InstancedMesh(crown,new THREE.MeshStandardMaterial({color:'white',roughness:1}),pinePositions.length*20)
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14,.23,2,9),new THREE.MeshStandardMaterial({color:'#6e5037',roughness:1}),pinePositions.length)
    let index=0
    pinePositions.forEach(({x,z,scale},tree)=>{
      matrix.position.set(x,1*scale,z);matrix.rotation.set(0,tree*.7,0);matrix.scale.setScalar(scale);matrix.updateMatrix();trunks.setMatrixAt(tree,matrix.matrix)
      for(let tier=0;tier<5;tier++) for(let branch=0;branch<(tier>2?1:4);branch++) {
        const angle=branch*Math.PI/2+tier*.86+tree, width=(1.05-tier*.17)*scale
        const spread=branch===0?0:width*.48
        matrix.position.set(x+Math.cos(angle)*spread,(1.55+tier*.53-(branch===0?0:.2))*scale+random()*.12,z+Math.sin(angle)*spread)
        matrix.rotation.set(Math.sin(angle)*.13,angle,Math.cos(angle)*.13)
        matrix.scale.set(width*(branch===0?1:.66),(.95+random()*.35)*scale,width*(branch===0?1:.72))
        matrix.updateMatrix();leaves.setMatrixAt(index,matrix.matrix)
        colour.set('#3f6345').lerp(new THREE.Color('#7d9055'),random()*.38+tier*.04);leaves.setColorAt(index++,colour)
      }
    })
    leaves.count=index;leaves.castShadow=true;leaves.receiveShadow=true;trunks.castShadow=true
    root.add(leaves,trunks)

    const blade=new THREE.BufferGeometry()
    blade.setAttribute('position',new THREE.Float32BufferAttribute([-.025,0,0,.025,0,0,.08,.28,.03,0,0,-.025,0,0,.025,-.05,.22,.01,-.02,0,-.02,.02,0,.02,-.08,.17,.03],3))
    blade.computeVertexNormals()
    const grass=new THREE.InstancedMesh(blade,new THREE.MeshStandardMaterial({color:'white',roughness:1,side:THREE.DoubleSide}),2400)
    let count=0
    for(let attempt=0;attempt<16000 && count<2400;attempt++) {
      const x=(random()-.5)*35,z=(random()-.5)*35
      if(!canStandAt(x,z)||Math.hypot(x,z)>16.2||pathDistance(x,z)<1.1||Math.hypot(x-pond.x,z-pond.z)<4.45)continue
      matrix.position.set(x,0,z);matrix.rotation.set(0,random()*Math.PI*2,0);matrix.scale.setScalar(.3+random()*.55);matrix.updateMatrix()
      grass.setMatrixAt(count,matrix.matrix);colour.set('#536f35').lerp(new THREE.Color('#a7aa60'),random()*.65);grass.setColorAt(count++,colour)
    }
    grass.count=count;grass.receiveShadow=true;root.add(grass)

    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:'white',roughness:.95}),54)
    for(let i=0;i<54;i++) {
      const angle=i*2.39996,radius=coastRadius(angle)-.45+random()*.8,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius
      const size=.35+random()*.8
      matrix.position.set(x,terrainHeight(x,z)+.25,z);matrix.rotation.set(random()*.4,angle,random()*.3);matrix.scale.set(size, size*(.6+random()*.5),size*(.75+random()*.5));matrix.updateMatrix()
      rocks.setMatrixAt(i,matrix.matrix);colour.set('#777b6e').lerp(new THREE.Color('#b5ae92'),random()*.7);rocks.setColorAt(i,colour)
    }
    rocks.castShadow=true;rocks.receiveShadow=true;root.add(rocks)
    return root
  },[])
  useEffect(()=>()=>group.traverse((o)=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();if(o instanceof THREE.InstancedMesh)o.dispose()}}),[group])
  return <primitive object={group} dispose={null} />
}
