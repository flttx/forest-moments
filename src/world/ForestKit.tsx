import {daylightAt,lanternPower} from '../game/dayCycle'
import {terrainHeight} from './terrain'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { vegetationPositions, lampPositions } from './vegetationLayout'
import type { PlantKit, VegetationInstance } from './vegetationLayout'
import { patchFoliageMaterial } from './foliageMaterial'
import { maskedCentroid, nearestAnchors } from './lampAnchors'
import { transformedGeometry } from './transformedGeometry'
import { useForestStore } from '../game/store'
import { updateFoliageOcclusion } from './foliageOcclusion'
import type { FoliageOccluder } from './foliageOcclusion'

export function ForestKit() {
  const high=useGLTF('/assets/vegetation/forest-kit.glb',true,true)
  const low=useGLTF('/assets/vegetation/forest-kit-lod.glb',true,true)
  const mask=useTexture('/assets/vegetation/lantern-glow.webp')
  const field=useMemo(()=>{
    const root=new THREE.Group();root.name='forest-kit'
    const focus={value:new THREE.Vector3()}
    const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[]
    const chunks:{hi:THREE.InstancedMesh;lo:THREE.InstancedMesh;center:THREE.Vector3;far:boolean;visibility:THREE.InstancedBufferAttribute;occluders:FoliageOccluder[]}[]=[]
    const anchors:number[]=[]
    const image=mask.image as HTMLImageElement
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
    const context=canvas.getContext('2d',{willReadFrequently:true})
    if(!context)throw Error('Cannot decode lantern mask')
    context.drawImage(image,0,0)
    const pixels={width:canvas.width,height:canvas.height,data:context.getImageData(0,0,canvas.width,canvas.height).data}
    const glow=mask.clone();glow.flipY=false;glow.colorSpace=THREE.NoColorSpace;glow.needsUpdate=true
    const requested=new URLSearchParams(location.search).get('light')
    const power=requested==='night'?1:requested==='dusk'?.65:0
    high.scene.updateMatrixWorld(true);low.scene.updateMatrixWorld(true)
    const dummy=new THREE.Object3D()
    const place=(mesh:THREE.InstancedMesh,items:VegetationInstance[])=>{
      items.forEach((p,i)=>{dummy.position.set(p.x,terrainHeight(p.x,p.z),p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)})
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.receiveShadow=true
    }
    for(const kit of ['tall-pine-a','normal-pine-b','round-tree-a','young-tree-b','bush-a','lantern'] as PlantKit[]) {
      const source=high.scene.getObjectByName('Eco_'+kit) as THREE.Mesh
      if(!source?.isMesh)throw Error('Missing vegetation template '+kit)
      const geometry=transformedGeometry(source.geometry,source.matrixWorld);geometries.push(geometry)
      const material=(source.material as THREE.MeshStandardMaterial).clone();materials.push(material)
      const all=kit==='lantern'?lampPositions:vegetationPositions.filter(p=>p.kit===kit)
      if(kit==='lantern') {
        material.emissive.set('#ffb15c');material.emissiveMap=glow;material.emissiveIntensity=3.2*power
        const mesh=new THREE.InstancedMesh(geometry,material,all.length);mesh.name='wooden-lanterns';place(mesh,all);mesh.castShadow=true;root.add(mesh)
        const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),positions:number[]=[],uvs:number[]=[]
        for(let i=0;i<p.count;i++)positions.push(p.getX(i),p.getY(i),p.getZ(i))
        for(let i=0;i<uv.count;i++)uvs.push(uv.getX(i),uv.getY(i))
        const anchor=maskedCentroid(positions,uvs,pixels)
        if(!anchor)throw Error('Lantern mask has no matching glass vertices')
        const m=new THREE.Matrix4()
        all.forEach((_,i)=>{mesh.getMatrixAt(i,m);anchors.push(...new THREE.Vector3(...anchor).applyMatrix4(m).toArray())})
        continue
      }
      patchFoliageMaterial(material)
      geometry.computeBoundingBox()
      const bounds=geometry.boundingBox!,height=bounds.max.y-bounds.min.y
      const width=Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)
      const lod=low.scene.getObjectByName('LOD_Eco_'+kit) as THREE.Mesh
      const lodGeometry=transformedGeometry(lod.geometry,lod.matrixWorld);geometries.push(lodGeometry)
      const groups=new Map<string,VegetationInstance[]>()
      for(const p of all){const key=`${Math.floor(p.x/8)},${Math.floor(p.z/8)}`;groups.set(key,[...(groups.get(key)??[]),p])}
      for(const [key,items] of groups) {
        const visibility=new THREE.InstancedBufferAttribute(new Float32Array(items.length).fill(1),1)
        visibility.setUsage(THREE.DynamicDrawUsage)
        // Share mesh buffers between chunks, but keep each chunk's coverage attribute independent.
        const withCoverage=(source:THREE.BufferGeometry)=>{
          const g=new THREE.BufferGeometry();g.setIndex(source.index)
          for(const [name,attribute] of Object.entries(source.attributes))g.setAttribute(name,attribute)
          g.setAttribute('foliageVisibility',visibility);geometries.push(g);return g
        }
        const hi=new THREE.InstancedMesh(withCoverage(geometry),material,items.length),lo=new THREE.InstancedMesh(withCoverage(lodGeometry),material,items.length)
        // Include a shoulder-width margin so needles beside the focus point do not cover the actor.
        const margin=kit==='bush-a'?.2:.55
        const occluders=items.map(p=>({center:{x:p.x,y:terrainHeight(p.x,p.z)+(bounds.min.y+height*.55)*p.scale,z:p.z},radius:{x:width*.55*p.scale+margin,y:height*.55*p.scale+.25,z:width*.55*p.scale+margin},hidden:false,visibility:1}))
        hi.name=`${kit}-${key}`;lo.name=`lod-${kit}-${key}`;place(hi,items);place(lo,items)
        hi.castShadow=true;lo.castShadow=true;lo.visible=false
        root.add(hi,lo);chunks.push({hi,lo,center:hi.boundingSphere!.center.clone(),far:false,visibility,occluders})
      }
    }
    const lights=Array.from({length:4},()=>{const l=new THREE.PointLight('#ffbd79',0,9,2);root.add(l);return {light:l,index:-1}})
    return {root,focus,chunks,materials,geometries,anchors,lights,glow,power,picked:[] as number[]}
  },[high.scene,low.scene,mask])
  const runtime=useRef(field)
  useEffect(()=>()=>{
    field.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()})
    field.materials.forEach(m=>m.dispose());field.geometries.forEach(g=>g.dispose());field.glow.dispose();field.lights.forEach(l=>l.light.dispose())
  },[field])
  useFrame(({camera,gl},dt)=>{
    const field=runtime.current
    field.power=lanternPower(daylightAt(useForestStore.getState()))
    for(const m of field.materials)if(m instanceof THREE.MeshStandardMaterial&&m.emissiveMap===field.glow)m.emissiveIntensity=3.2*field.power
    const state=useForestStore.getState(),p=state.position
    if(state.mode==='lookout')field.focus.value.copy(camera.position)
    else field.focus.value.set(p.x,terrainHeight(p.x,p.z)+.9,p.z)
    for(const c of field.chunks) {
      const d=c.center.distanceTo(camera.position)
      c.far=c.far?d>27:d>31;c.hi.visible=!c.far;c.lo.visible=c.far
      let changed=false
      c.occluders.forEach((tree,i)=>{
        updateFoliageOcclusion(tree,camera.position,field.focus.value,dt)
        if(Math.abs(c.visibility.getX(i)-tree.visibility)>1e-6){c.visibility.setX(i,tree.visibility);changed=true}
      })
      if(changed)c.visibility.needsUpdate=true
    }
    nearestAnchors(field.anchors,p.x,p.z,5,40,field.picked)
    const wanted=field.picked.slice(0,4)
    const next=field.picked[4]
    const boundary=next===undefined?40:Math.hypot(field.anchors[next*3]-p.x,field.anchors[next*3+2]-p.z)
    for(const slot of field.lights) {
      const retained=wanted.includes(slot.index)
      if(!retained&&slot.light.intensity<.015) {
        if(import.meta.env.DEV)slot.light.userData.assignmentIntensity=slot.light.intensity
        slot.index=wanted.find(i=>!field.lights.some(s=>s.index===i))??-1
        if(slot.index>=0)slot.light.position.fromArray(field.anchors,slot.index*3)
      }
      const d=slot.index<0?40:Math.hypot(slot.light.position.x-p.x,slot.light.position.z-p.z)
      const target=wanted.includes(slot.index)?3.5*field.power*THREE.MathUtils.clamp((boundary-d)/4,0,1):0
      slot.light.intensity=THREE.MathUtils.damp(slot.light.intensity,target,8,Math.min(dt,.05))
    }
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa'))gl.domElement.dataset.vegetationQa=JSON.stringify({plants:vegetationPositions.length,lamps:lampPositions.length,lodChunks:field.chunks.filter(c=>c.far).length,occlusion:{hidden:field.chunks.reduce((n,c)=>n+c.occluders.filter(t=>t.visibility===0).length,0),transitioning:field.chunks.reduce((n,c)=>n+c.occluders.filter(t=>t.visibility>0&&t.visibility<1).length,0)},anchors:field.anchors,lights:field.lights.map(s=>({index:s.index,intensity:s.light.intensity,assignmentIntensity:s.light.userData.assignmentIntensity??0,position:s.light.position.toArray()}))})
  })
  return <primitive object={field.root} dispose={null}/>
}
