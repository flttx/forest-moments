import * as THREE from 'three'
import type {Light} from './fishSpecies'
import {carvingReach,heartStoneAngle} from './secrets'

/**
 * Photo tasks (docs/GAMEPLAY_EXPANSION_PLAN.md §2.6): what a picture shows, judged from the camera, not from pixels.
 * A subject counts when its box sits in the frame large enough, unhidden, at the right time. Pure apart from the
 * `clear` line-of-sight test the scene supplies.
 */
export const subjectIds=['sunsetSea','fireflies','cabin','fireside','boatSunset','jellyfish','constellation','carving','heartStone'] as const
export type SubjectId=typeof subjectIds[number]

export interface Framing{
 /** Share of the box's corners in front of the camera and inside the picture. */
 inside:number
 /** Share of the picture covered by the box's projected outline (clipped to the picture). */
 area:number
}
const corners=(b:THREE.Box3)=>[0,1,2,3,4,5,6,7].map(i=>new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z))
/** Where a box lands in the picture, for a combined projection × view matrix. */
export function frameBox(box:THREE.Box3,viewProjection:THREE.Matrix4):Framing{
 let inside=0,x0=1,x1=-1,y0=1,y1=-1,front=0
 for(const c of corners(box)){
  const p=new THREE.Vector4(c.x,c.y,c.z,1).applyMatrix4(viewProjection)
  if(p.w<=1e-6)continue
  front++
  const x=p.x/p.w,y=p.y/p.w
  if(Math.abs(x)<=1&&Math.abs(y)<=1)inside++
  x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)
 }
 if(!front)return{inside:0,area:0}
 const clip=(a:number)=>Math.max(-1,Math.min(1,a)),area=Math.max(0,clip(x1)-clip(x0))*Math.max(0,clip(y1)-clip(y0))/4
 return{inside:inside/8,area}
}
export function inPicture(point:THREE.Vector3,viewProjection:THREE.Matrix4,margin=0){
 const p=new THREE.Vector4(point.x,point.y,point.z,1).applyMatrix4(viewProjection)
 return p.w>1e-6&&Math.abs(p.x/p.w)<=1-margin&&Math.abs(p.y/p.w)<=1-margin
}

export interface Shot{
 light:Light
 mode:string
 /** Seat id when settled on one. */
 seat:string|null
 fireLit:boolean
 raccoonShown:boolean
 raccoon:THREE.Box3|null
 cabin:THREE.Box3|null
 campfire:THREE.Box3|null
 /** Unit direction toward the sun. */
 sun:THREE.Vector3
 fireflies:readonly THREE.Vector3[]
 /** The jellyfish by the jetty (hidden corner), when the scene has it. */
 jellyfish:THREE.Vector3|null
 /** Unit direction to the raccoon constellation's centre. */
 constellation:THREE.Vector3
 /** The carving on the lookout timber, once the scene has placed it. */
 carving:THREE.Vector3|null
 /** Centre of the heart stone's face and the face's horizontal normal (either side shows the heart). */
 heartStone:{centre:THREE.Vector3;normal:THREE.Vector3}|null
 camera:THREE.Vector3
 viewProjection:THREE.Matrix4
 /** Nothing stands between the camera and this point. */
 clear:(point:THREE.Vector3)=>boolean
}

const sunInView=(s:Shot)=>s.light==='dusk'&&inPicture(s.camera.clone().addScaledVector(s.sun,200),s.viewProjection,.04)
const whole=(box:THREE.Box3|null,s:Shot,inside:number,area:number)=>{if(!box)return false;const f=frameBox(box,s.viewProjection);return f.inside>=inside&&f.area>=area&&s.clear(box.getCenter(new THREE.Vector3()))}

function heartFaceOn(stone:{centre:THREE.Vector3;normal:THREE.Vector3},camera:THREE.Vector3){
 const to=camera.clone().sub(stone.centre);to.y=0
 const d=to.length();if(d<1.5||d>14)return false
 return Math.acos(Math.min(1,Math.abs(to.dot(stone.normal))/d))<heartStoneAngle
}

/** Every subject this picture shows. */
export function subjectsIn(s:Shot):SubjectId[]{
 const near=s.fireflies.filter(p=>p.distanceTo(s.camera)<15&&inPicture(p,s.viewProjection))
 const found:Record<SubjectId,boolean>={
  sunsetSea:sunInView(s),
  boatSunset:s.mode==='rowing'&&sunInView(s),
  fireflies:s.light==='night'&&near.length>=4,
  // The whole cabin, big enough to read as a picture of it.
  cabin:whole(s.cabin,s,.9,.06),
  // Hidden corners: the glowing jellyfish close by at night, the raccoon constellation in a night sky.
  jellyfish:s.light==='night'&&!!s.jellyfish&&s.jellyfish.distanceTo(s.camera)<14&&inPicture(s.jellyfish,s.viewProjection,.02)&&s.clear(s.jellyfish),
  constellation:s.light==='night'&&inPicture(s.camera.clone().addScaledVector(s.constellation,200),s.viewProjection,.05),
  // The carving up close, toward the middle of the picture; the heart stone roughly square on, not edge on.
  carving:!!s.carving&&s.carving.distanceTo(s.camera)<carvingReach&&inPicture(s.carving,s.viewProjection,.25)&&s.clear(s.carving),
  heartStone:!!s.heartStone&&heartFaceOn(s.heartStone,s.camera)&&inPicture(s.heartStone.centre,s.viewProjection,.15)&&s.clear(s.heartStone.centre),
  fireside:s.fireLit&&s.raccoonShown&&s.mode==='sitting'&&!!s.seat?.startsWith('camp-')&&whole(s.raccoon,s,.75,.01)&&whole(s.campfire,s,.6,.004),
 }
 return subjectIds.filter(id=>found[id])
}
