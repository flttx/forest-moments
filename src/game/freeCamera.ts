import type {CameraBox,CameraPoint,CameraSphere} from './followCamera'

/**
 * Free framing for photo mode (docs/JOURNAL_PHOTO_PLAN.md §3.2): the camera is flown by hand, but stays within
 * a few strides of the raccoon and outside ground, buildings and tree crowns. Pure; the scene supplies the solids.
 */
export const freeRadius=15
export const freeSpeed=4
export const freePitchLimit=1.45
export const freeClearance=.3
export interface FreeView extends CameraPoint{yaw:number;pitch:number}
export interface FreeSpace{
 boxes:readonly CameraBox[]
 crowns:readonly CameraSphere[]
 /** Ground (or water) height under a point. */
 floor:(x:number,z:number)=>number
 /** Indoors: the room's half extents and ceiling; the island has none. */
 room?:{x:number;z:number;ceiling:number}
}

/** Unit view direction: yaw 0 looks along +z, positive yaw turns towards +x (as the tower look-around does). */
export const lookDirection=(v:Pick<FreeView,'yaw'|'pitch'>)=>({x:Math.sin(v.yaw)*Math.cos(v.pitch),y:Math.sin(v.pitch),z:Math.cos(v.yaw)*Math.cos(v.pitch)})
export function viewFromDirection(position:CameraPoint,dir:CameraPoint):FreeView{
 const length=Math.hypot(dir.x,dir.y,dir.z)||1
 return{x:position.x,y:position.y,z:position.z,yaw:Math.atan2(dir.x,dir.z),pitch:Math.asin(Math.max(-1,Math.min(1,dir.y/length)))}
}
export function turnFreeView(v:FreeView,dx:number,dy:number):FreeView{
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return v
 return{...v,yaw:Math.atan2(Math.sin(v.yaw-dx*.004),Math.cos(v.yaw-dx*.004)),pitch:Math.max(-freePitchLimit,Math.min(freePitchLimit,v.pitch-dy*.003))}
}
/** Walks the view: forward/right along the ground heading, up straight up; each in -1..1. */
export function moveFreeView(v:FreeView,input:{forward:number;right:number;up:number},distance:number):FreeView{
 const f={x:Math.sin(v.yaw),z:Math.cos(v.yaw)},length=Math.hypot(input.forward,input.right)||1
 const forward=input.forward/length*distance,right=input.right/length*distance
 return{...v,x:v.x+f.x*forward-f.z*right,z:v.z+f.z*forward+f.x*right,y:v.y+input.up*distance}
}
/** Moves along the look direction (the wheel). */
export function dollyFreeView(v:FreeView,distance:number):FreeView{
 const d=lookDirection(v);return{...v,x:v.x+d.x*distance,y:v.y+d.y*distance,z:v.z+d.z*distance}
}

const inside=(p:CameraPoint,b:CameraBox,pad:number)=>p.x>b.minX-pad&&p.x<b.maxX+pad&&p.y>b.minY-pad&&p.y<b.maxY+pad&&p.z>b.minZ-pad&&p.z<b.maxZ+pad

/** Puts a camera position back into allowed space: within the radius of `centre`, out of solids and crowns, above the floor. */
export function constrainFreePosition(p:CameraPoint,centre:CameraPoint,space:FreeSpace,radius=freeRadius,pad=freeClearance):CameraPoint{
 let {x,y,z}=p
 const pull=()=>{
  const dx=x-centre.x,dy=y-centre.y,dz=z-centre.z,d=Math.hypot(dx,dy,dz)
  if(d>radius){const k=radius/d;x=centre.x+dx*k;y=centre.y+dy*k;z=centre.z+dz*k}
 }
 for(let pass=0;pass<3;pass++){
  pull()
  for(const b of space.boxes){
   const q={x,y,z}
   if(!inside(q,b,pad)||inside(centre,b,0))continue
   // Out through the nearest face.
   const out=[
    {d:x-(b.minX-pad),apply:()=>{x=b.minX-pad}},{d:b.maxX+pad-x,apply:()=>{x=b.maxX+pad}},
    {d:y-(b.minY-pad),apply:()=>{y=b.minY-pad}},{d:b.maxY+pad-y,apply:()=>{y=b.maxY+pad}},
    {d:z-(b.minZ-pad),apply:()=>{z=b.minZ-pad}},{d:b.maxZ+pad-z,apply:()=>{z=b.maxZ+pad}},
   ].reduce((a,c)=>c.d<a.d?c:a)
   out.apply()
  }
  for(const c of space.crowns){
   const r=c.r+pad,dx=x-c.x,dy=y-c.y,dz=z-c.z,d=Math.hypot(dx,dy,dz)
   // A crown that also holds the raccoon cannot be avoided; leave it.
   if(d>=r||Math.hypot(centre.x-c.x,centre.y-c.y,centre.z-c.z)<r)continue
   const k=d>1e-6?r/d:0
   if(k){x=c.x+dx*k;y=c.y+dy*k;z=c.z+dz*k}else y=c.y+r
  }
 }
 const room=space.room
 if(room){x=Math.max(-room.x,Math.min(room.x,x));z=Math.max(-room.z,Math.min(room.z,z));y=Math.min(room.ceiling,y)}
 y=Math.max(y,space.floor(x,z)+pad)
 return{x,y,z}
}
