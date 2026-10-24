import {lookoutPosition} from '../world/worldConfig'

// Entry beside the original stair foot; camera above the sampled 3.638 m deck.
export const lookoutEntry={x:lookoutPosition[0]+2.45,z:lookoutPosition[2]-1.65}
export const lookoutEye={x:lookoutPosition[0],y:4.9,z:lookoutPosition[2]}
export const initialLookoutView={yaw:-1.05,pitch:-.22}
export type LookoutView=typeof initialLookoutView
export type LookoutTransfer={direction:'enter'|'exit';elapsed:number;committed:boolean}
export function canViewLookout(position:{x:number;z:number}){
 return Math.hypot(position.x-lookoutEntry.x,position.z-lookoutEntry.z)<=.75
}
export function turnLookout(view:LookoutView,yaw:number,pitch:number):LookoutView{
 if(!Number.isFinite(yaw)||!Number.isFinite(pitch)||(yaw===0&&pitch===0))return view
 return{yaw:Math.atan2(Math.sin(view.yaw+yaw),Math.cos(view.yaw+yaw)),pitch:Math.max(-.48,Math.min(.18,view.pitch+pitch))}
}
