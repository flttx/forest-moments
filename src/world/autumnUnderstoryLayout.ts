import {autumnHeight,autumnPathDistance,autumnRadius,autumnVista} from './autumnIsland'
import {autumnPlants,autumnEdgePlants} from './vegetationLayout'
import {autumnShorePieces,coastKits} from './coastalLayout'
import {canStandAt} from '../game/movement'

// Conservative horizontal radius from the authored fern GLB bounds, before instance scale.
export const fernReach=.67
/** Soft low fronds in small woodland pockets, without extra solids or a continuous path border. */
export const autumnFerns=(()=>{
 const plants:{x:number;z:number;scale:number;yaw:number}[]=[]
 for(let x=97;x<125;x+=1.3)for(let z=34;z<61;z+=1.3){
  const n=Math.sin(x*17.7+z*29.3)*43758.5,f=n-Math.floor(n),px=x+(f-.5)*.8,pz=z+Math.cos(n)*.4,scale=.8+f*.3,reach=fernReach*scale
  const path=autumnPathDistance(px,pz)
  if(f<.43||autumnRadius(px,pz)>.79||autumnHeight(px,pz)<.7||path<reach+1.05||path>4.5||!canStandAt(px,pz))continue
  if(Math.hypot(px-110,pz-47)<3.3||Math.hypot(px-autumnVista.x,pz-autumnVista.z)<5)continue
  if(autumnPlants.some(p=>Math.hypot(px-p.x,pz-p.z)<reach+1)||autumnEdgePlants.some(p=>Math.hypot(px-p.x,pz-p.z)<reach+.75*p.scale))continue
  if(![...autumnPlants,...autumnEdgePlants].some(p=>Math.hypot(px-p.x,pz-p.z)<3.4))continue
  if(autumnShorePieces.some(p=>Math.hypot(px-p.x,pz-p.z)<reach+coastKits[p.kit].half*p.scale+.2))continue
  if(Math.hypot(autumnHeight(px+.3,pz)-autumnHeight(px-.3,pz),autumnHeight(px,pz+.3)-autumnHeight(px,pz-.3))/.6>.5)continue
  if(plants.some(p=>Math.hypot(px-p.x,pz-p.z)<.95))continue
  plants.push({x:px,z:pz,scale,yaw:f*Math.PI*2})
 }
 return plants
})()
