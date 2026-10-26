import boxes from './workshopColliders.json'
import {workpieceSpot} from './workshop'

/** Authored Blender furniture and wall bounds, in glTF X/Z coordinates. */
export function canStandInWorkshop(x:number,z:number,pieceVisible=false){
 // The doorway stops 0.28 m short of the door leaf (z 3.0), like every wall.
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>3.72||z< -2.72||z>2.72)return false
 if(pieceVisible&&Math.hypot(x-workpieceSpot.x,z-workpieceSpot.z)<.75)return false
 return !boxes.some(b=>b.name!=='Collider_Stool'&&Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ))<.28)
}
export function moveInWorkshop(start:{x:number;z:number},dx:number,dz:number,pieceVisible=false){
 if(![start.x,start.z,dx,dz].every(Number.isFinite))return{...start}
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));let{x,z}=start
 for(let i=0;i<n;i++){
  if(canStandInWorkshop(x+dx/n,z,pieceVisible))x+=dx/n
  if(canStandInWorkshop(x,z+dz/n,pieceVisible))z+=dz/n
 }
 return{x,z}
}
