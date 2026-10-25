import roomBoxes from './workshopColliders.json'
import {farmColliders} from './farm'
import {modelAssets,workshopPosition,lookoutPosition,workshopSize} from '../world/assets'
import {cabin} from './expansion'
import {orbitConfig} from './orbitCamera'

export type CameraPoint={x:number;y:number;z:number}
export type CameraBox={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}
export const indoorCameraBoxes:CameraBox[]=roomBoxes.filter(b=>b.name!=='Collider_Stool').map(b=>({...b,minY:0,maxY:/North|South|East$|West$|Door/.test(b.name)?3.6:/Shelf|ToolRack/.test(b.name)?2.5:b.name==='Collider_Stove'?2.1:1.15}))
export const bedroomCameraBoxes:CameraBox[]=[
 {minX:-4.1,maxX:-3.8,minZ:-3,maxZ:3,minY:0,maxY:3.6},{minX:3.8,maxX:4.1,minZ:-3,maxZ:3,minY:0,maxY:3.6},
 {minX:-4,maxX:4,minZ:-3.1,maxZ:-2.8,minY:0,maxY:3.6},{minX:-4,maxX:4,minZ:2.8,maxZ:3.1,minY:0,maxY:3.6},
 {minX:-3.03,maxX:-1.37,minZ:-2,maxZ:.7,minY:0,maxY:.8},{minX:1.58,maxX:3.02,minZ:-1.61,maxZ:-.99,minY:0,maxY:1.3},
]
export const outdoorCameraBoxes:CameraBox[]=[
 ...[{x:workshopPosition[0],y:0,z:workshopPosition[2],hx:workshopSize.halfX*modelAssets.workshop.scale,hz:workshopSize.halfZ*modelAssets.workshop.scale,height:workshopSize.height*modelAssets.workshop.scale},
 {x:cabin.x,y:7.3,z:cabin.z,hx:cabin.halfX,hz:cabin.halfZ,height:4.8},
 {x:lookoutPosition[0],y:lookoutPosition[1],z:lookoutPosition[2],hx:1.618776*modelAssets.lookout.scale,hz:2.14244*modelAssets.lookout.scale,height:6.8}].map(b=>({minX:b.x-b.hx,maxX:b.x+b.hx,minZ:b.z-b.hz,maxZ:b.z+b.hz,minY:b.y,maxY:b.y+b.height})),
 ...farmColliders.map(b=>({minX:b.x-b.halfX,maxX:b.x+b.halfX,minZ:b.z-b.halfZ,maxZ:b.z+b.halfZ,minY:0,maxY:1.6})),
]
export type FollowTurn={yaw:number;velocity:number;target:number;candidate:number;intentTime:number}
export const followTurnConfig={intentDelay:.18,headingDeadZone:Math.PI/30,maxSpeed:Math.PI/2,maxAcceleration:Math.PI*2} as const
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a))
const clamp=(n:number,limit:number)=>Math.max(-limit,Math.min(limit,n))
export function createFollowTurn(yaw:number):FollowTurn{return{yaw,velocity:0,target:yaw,candidate:yaw,intentTime:0}}
/** Confirm movement intent, then rotate a damped camera arm independently of the actor. */
export function stepFollowTurn(previous:FollowTurn,heading:number,moving:boolean,dt:number):FollowTurn{
 if(!Number.isFinite(dt)||!Number.isFinite(heading)||dt<=0)return previous
 const next={...previous},duration=Math.min(dt,.05),steps=Math.ceil(duration*120),h=duration/steps
 for(let i=0;i<steps;i++){
  if(!moving)next.intentTime=0
  else{
   if(Math.abs(angleDelta(next.candidate,heading))>.03){next.candidate=heading;next.intentTime=0}
   next.intentTime+=h
   if(next.intentTime>=followTurnConfig.intentDelay&&Math.abs(angleDelta(next.target,heading))>followTurnConfig.headingDeadZone)next.target=heading
  }
  // Critically damped spring, with bounded acceleration and speed for large reversals.
  const error=angleDelta(next.yaw,next.target)
  const acceleration=clamp(16*error-8*next.velocity,followTurnConfig.maxAcceleration)
  next.velocity=clamp(next.velocity+acceleration*h,followTurnConfig.maxSpeed)
  next.yaw+=next.velocity*h
 }
 return next
}
/** Last actual displacement supplies heading; a held key against a wall cannot spin the view. */
export function movementYaw(dx:number,dz:number,previous:number){return Math.hypot(dx,dz)>.00001?Math.atan2(-dx,-dz):previous}

/** Shorten the camera arm against padded solids, including the near-plane clearance. */
export function clipCameraArm(target:CameraPoint,eye:CameraPoint,boxes:readonly CameraBox[],padding=.18):CameraPoint{
 let fraction=1
 for(const b of boxes){
  let low=0,high=1,hit=true,inside=true
  for(const axis of ['x','y','z'] as const){
   const k=axis.toUpperCase() as 'X'|'Y'|'Z',min=b[`min${k}`]-padding,max=b[`max${k}`]+padding
   const origin=target[axis],delta=eye[axis]-origin
   if(origin<min||origin>max)inside=false
   if(Math.abs(delta)<1e-8){if(origin<min||origin>max){hit=false;break}}
   else{const a=(min-origin)/delta,c=(max-origin)/delta;low=Math.max(low,Math.min(a,c));high=Math.min(high,Math.max(a,c));if(low>high){hit=false;break}}
  }
  // A conservative proxy may contain the focus point at an interaction station.
  if(hit&&!inside&&low>=0&&low<=1)fraction=Math.min(fraction,Math.max(0,low-.015))
 }
 return{x:target.x+(eye.x-target.x)*fraction,y:target.y+(eye.y-target.y)*fraction,z:target.z+(eye.z-target.z)*fraction}
}

/** Keep close orbit centred on the player; wide orbit frames the whole island. */
export function outdoorOrbitFocus(position:CameraPoint,zoom:number,pitch:number){
 const t=Math.max(0,Math.min(1,(zoom-2.5)/7.5)),wide=t*t*(3-2*t)
 return{target:{x:position.x*(1-wide),y:(position.y+.8)*(1-wide)+4*wide,z:position.z*(1-wide)},pitch:Math.max(pitch,.58*wide)}
}
export function walkingCamera(position:CameraPoint,yaw:number,inside:boolean,orbit?:{pitch:number;zoom:number},boxes=inside?indoorCameraBoxes:outdoorCameraBoxes){
 const distance=inside?3.4:9,height=inside?2.65:5.8
 const zoom=Math.min(orbit?.zoom??1,inside?orbitConfig.indoorMaxZoom:orbitConfig.maxZoom),angle=orbit?.pitch??Math.atan2(height-.8,distance)
 const {target,pitch}=inside?{target:{x:position.x,y:position.y+.8,z:position.z},pitch:angle}:outdoorOrbitFocus(position,zoom,angle)
 const radius=Math.hypot(distance,height-.8)*zoom
 let eye={x:target.x+Math.sin(yaw)*Math.cos(pitch)*radius,y:Math.min(inside?3.05:Infinity,target.y+Math.sin(pitch)*radius),z:target.z+Math.cos(yaw)*Math.cos(pitch)*radius}
 eye=clipCameraArm(target,eye,boxes)
 if(!inside&&Math.hypot(eye.x-target.x,eye.z-target.z)<1.35)eye.y=position.y+3.2
 if(inside){
  // At the wall, lift above the character instead of pushing the camera into its head.
  if(Math.hypot(eye.x-target.x,eye.z-target.z)<1.35)eye.y=3.05
  eye.x=Math.max(-3.72,Math.min(3.72,eye.x));eye.z=Math.max(-2.72,Math.min(2.72,eye.z))
 }
 return{eye,target}
}
