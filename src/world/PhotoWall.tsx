import {useEffect,useState} from 'react'
import * as THREE from 'three'
import {usePhotoStore} from '../game/photoStore'
import {listPhotos} from '../game/photoAlbum'
import {wallSlots} from '../game/photoWall'

/** Wooden frames on the bedroom's north wall, three on each side of the window (over the bed, then over the tank). */
const wallFrames=[[-3,2.12],[-2.3,2.12],[-2.65,1.58],[2.3,2.12],[3,2.12],[2.65,1.58]].slice(0,wallSlots).map(([x,y])=>({x,y,z:-2.78}))
const frameWood=new THREE.MeshStandardMaterial({color:'#7a5536',roughness:.85})
const matPaper=new THREE.MeshStandardMaterial({color:'#efe6d0',roughness:.95})

export function PhotoWall(){
 const wall=usePhotoStore(s=>s.wall),version=usePhotoStore(s=>s.albumVersion)
 const [textures,setTextures]=useState<Map<string,THREE.Texture>>(new Map())
 useEffect(()=>{
  let live=true;const made=new Map<string,THREE.Texture>()
  listPhotos().then(async records=>{
   for(const r of records.filter(r=>wall.includes(r.id))){
    // ImageBitmaps ignore texture.flipY: flip while decoding instead.
    const bitmap=await createImageBitmap(r.thumb,{imageOrientation:'flipY'}),texture=new THREE.CanvasTexture(bitmap);texture.colorSpace=THREE.SRGBColorSpace;made.set(r.id,texture)
   }
   if(live)setTextures(made);else made.forEach(t=>t.dispose())
  }).catch(()=>{/* No album: the frames stay empty. */})
  return()=>{live=false;made.forEach(t=>t.dispose())}
 },[wall,version])
 return <group name="photo-wall">{wall.map((id,i)=>{const map=textures.get(id),f=wallFrames[i]
  if(!map)return null
  const image=map.image as {width:number;height:number},aspect=image.width/image.height,w=.42,h=Math.min(.34,w/aspect)
  return <group key={id} position={[f.x,f.y,f.z]}>
   <mesh material={frameWood} position={[0,0,-.012]}><boxGeometry args={[w+.07,h+.07,.025]}/></mesh>
   <mesh material={matPaper} position={[0,0,.002]}><planeGeometry args={[w+.03,h+.03]}/></mesh>
   <mesh position={[0,0,.004]}><planeGeometry args={[w,h]}/><meshStandardMaterial map={map} roughness={.6}/></mesh>
  </group>})}</group>
}
