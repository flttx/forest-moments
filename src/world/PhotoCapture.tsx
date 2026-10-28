import {useFrame} from '@react-three/fiber'
import * as THREE from 'three'
import {usePhotoStore} from '../game/photoStore'
import {useForestStore} from '../game/store'
import {daylightAt} from '../game/dayCycle'
import {dayLighting} from './dayLighting'
import * as movement from '../game/movement'
import {subjectsIn,type SubjectId} from '../game/photoSubjects'
import {constellation,heartStone} from '../game/secrets'
import {rainbowRadius} from './rainbowArc'

// Small scattered dressing that should not count as blocking the view.
const seeThrough=/^(grass|path-embedded|pond-reeds|pond-lily)/
const boxOf=(scene:THREE.Object3D,name:string)=>{const o=scene.getObjectByName(name);return o?new THREE.Box3().setFromObject(o):null}

/** What the picture shows (photo tasks), judged from the camera and the scene at the moment of the shutter. */
function judge(scene:THREE.Scene,camera:THREE.Camera):SubjectId[]{
 const s=useForestStore.getState(),photo=usePhotoStore.getState()
 const flies=scene.getObjectByName('fireflies') as THREE.Points|undefined,glow=(flies?.material as THREE.ShaderMaterial|undefined)?.uniforms?.opacity?.value??0
 const attr=flies?.geometry.getAttribute('position'),fireflies:THREE.Vector3[]=[]
 // A thin autumn swarm still counts once it has faded in.
 if(attr&&glow>.3)for(let i=0;i<attr.count;i++)fireflies.push(new THREE.Vector3().fromBufferAttribute(attr,i))
 const ray=new THREE.Raycaster(),viewProjection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
 // Something well in front of the subject (not its own near side) blocks it.
 const clear=(point:THREE.Vector3)=>{
  const to=point.clone().sub(camera.position),d=to.length();ray.set(camera.position,to.normalize());ray.far=d*.8
  return !ray.intersectObjects(scene.children,true).some(h=>h.object.visible&&(h.object as THREE.Mesh).isMesh&&!seeThrough.test(h.object.name))
 }
 const outside=s.location==='island'
 const bow=scene.getObjectByName('rainbow'),rainbow=outside&&bow?.visible&&(bow.userData.opacity??0)>.2?[1,2,3,4,5].map(i=>bow.localToWorld(new THREE.Vector3(Math.cos(i*Math.PI/6)*rainbowRadius,Math.sin(i*Math.PI/6)*rainbowRadius,0))):[]
 const lanterns:THREE.Vector3[]=[];if(outside)scene.getObjectByName('river-lanterns')?.children.forEach(o=>{if(o.visible)lanterns.push(o.getWorldPosition(new THREE.Vector3()))})
 return subjectsIn({rainbow,lanterns,light:s.timeOfDay,mode:s.mode,seat:s.sitting?.phase==='idle'?s.sitting.id:null,fireLit:s.homeBook.fireLit,raccoonShown:!photo.hideRaccoon&&s.mode!=='rowing'&&s.mode!=='lookout',
  raccoon:boxOf(scene,'asset-raccoon'),cabin:outside?boxOf(scene,'expansion-cabin'):null,campfire:outside?boxOf(scene,'campfire'):null,
  sun:dayLighting(daylightAt(s),s.sunRising).sunPosition.clone().normalize(),fireflies:outside?fireflies:[],
  jellyfish:outside?scene.getObjectByName('secret-jellyfish')?.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.25,0))??null:null,constellation:new THREE.Vector3(...constellation.centre),
  carving:outside?scene.getObjectByName('secret-carving')?.getWorldPosition(new THREE.Vector3())??null:null,
  heartStone:outside?{centre:new THREE.Vector3(heartStone.x,movement.groundHeightAt(heartStone.x,heartStone.z)+heartStone.height*.5,heartStone.z),normal:new THREE.Vector3(heartStone.normal.x,0,heartStone.normal.z)}:null,camera:camera.position.clone(),viewProjection,clear})
}

/**
 * Reads the canvas right after the frame is composed, in the same task, so the picture is what is on screen
 * (the drawing buffer is not preserved between frames).
 */
export function PhotoCapture(){
 useFrame(({gl,scene,camera})=>{
  if(!usePhotoStore.getState().takePending())return
  const canvas=gl.domElement,{width,height}=canvas
  let subjects:SubjectId[]=[]
  try{subjects=judge(scene,camera)}catch{/* A failed judgement only loses the photo task, never the photo. */}
  canvas.toBlob(blob=>void usePhotoStore.getState().finish(blob,width,height,subjects),'image/png')
 },3)
 return null
}
