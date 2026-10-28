import {lookoutPosition,lookoutYaw} from '../world/worldConfig'

// Entry beside the stair foot (model space +2.45, -1.65, turned with the tower); camera above the sampled 3.638 m deck.
const stairFoot={x:2.45,z:-1.65}
export const lookoutEntry={x:lookoutPosition[0]+stairFoot.x*Math.cos(lookoutYaw)+stairFoot.z*Math.sin(lookoutYaw),z:lookoutPosition[2]-stairFoot.x*Math.sin(lookoutYaw)+stairFoot.z*Math.cos(lookoutYaw)}
export const lookoutEye={x:lookoutPosition[0],y:lookoutPosition[1]+4.9,z:lookoutPosition[2]}
// Opens on the north-west sea, where the sun sets.
export const initialLookoutView={yaw:-2.36,pitch:-.22}
export type LookoutView=typeof initialLookoutView
export type LookoutTransfer={direction:'enter'|'exit';elapsed:number;committed:boolean}
export function canViewLookout(position:{x:number;z:number}){
 return Math.hypot(position.x-lookoutEntry.x,position.z-lookoutEntry.z)<=.75
}
export function turnLookout(view:LookoutView,yaw:number,pitch:number):LookoutView{
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch)||(yaw===0&&pitch===0))return view
 return{yaw:Math.atan2(Math.sin(view.yaw+yaw),Math.cos(view.yaw+yaw)),pitch:Math.max(-.48,Math.min(.18,view.pitch+pitch))}
}
