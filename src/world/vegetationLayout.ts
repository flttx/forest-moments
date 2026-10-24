import {modelAssets,workshopSize,workshopPathOffset} from './assets'
import templates from './vegetation-templates.json'
import { pathDistance, islandShape } from './terrain'
import {workshopPosition,lookoutPosition,isBeachApproach} from './worldConfig'

export type PlantKit = keyof typeof templates
export interface VegetationInstance { kit: PlantKit; x: number; z: number; scale: number; yaw: number }
const originalLampPositions: VegetationInstance[] = [
  [-4.1,-2.5,0],[-8.6,13.1,.5],[15.8,-3.4,Math.PI],
  ...[-2.8,-1.9,-1,.25,.9,1.8,2.7].map(a=>[Math.cos(a)*22.1,Math.sin(a)*22.1,-a]),
].map(([x,z,yaw])=>({kit:'lantern',x,z,yaw,scale:1.3}))

export const lampPositions=originalLampPositions.map(p=>p.x===-8.6?{...p,z:13.6}:p)

/** Generous canopy buffers around gameplay and entrances, in metres. */
export function clearForVegetation(x:number,z:number,margin=0,pathOffset=workshopPathOffset) {
  if(Math.hypot(x,z)>islandShape.walkRadius-.3-margin) return false
  if(isBeachApproach(x,z))return false
  if(pathDistance(x,z,pathOffset)<1.5+margin) return false
  const exclusions=[[workshopPosition[0],workshopPosition[2],4.9],[lookoutPosition[0],lookoutPosition[2],4.7],[8,6,4.4],[6,-5,6.1],[0,8,2.8],[0,0,3.2],[1.5,-5,2.4],[8,8,2.8]]
  return exclusions.every(([cx,cz,r])=>Math.hypot(x-cx,z-cz)>r+margin)
    && (pathOffset===0?originalLampPositions:lampPositions).every(p=>Math.hypot(x-p.x,z-p.z)>2+margin)
}
function makeLayout() {
  let seed=20261024
  const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
  const plants:VegetationInstance[]=[]
  for(const [count,bush] of [[74,false],[38,true]] as const) {
    let added=0
    for(let attempt=0;attempt<30000&&added<count;attempt++) {
      const x=(random()-.5)*46,z=(random()-.5)*46,r=Math.hypot(x,z)
      if(r<9||!clearForVegetation(x,z,bush?0:.55,0))continue
      // Two open coastal sightlines; groves gather between them rather than forming a wall.
      const angle=Math.atan2(z,x)
      if(r>19 && (Math.abs(angle-.78)<.18||Math.abs(angle+2.4)<.18))continue
      if(plants.some(p=>Math.hypot(x-p.x,z-p.z)<(bush?1.15:2.55)))continue
      const choice=random()
      const kit:PlantKit=bush?'bush-a':choice<.17?'tall-pine-a':choice<.76?'normal-pine-b':choice<.88?'young-tree-b':'round-tree-a'
      plants.push({kit,x,z,yaw:random()*Math.PI*2,scale:bush?.65+random()*.4:kit==='tall-pine-a'?.8+random()*.16:.82+random()*.25})
      added++
    }
  }
  // Keep the pond/boarding and farm approach sightlines open before relying on material clipping.
  // Filter after sampling so thinning a foreground tree never relocates another trunk onto an existing route.
  const sightlines=[[15,13,8,6],[14,4,6,-5],[-4,17,-12,8]]
  return plants.filter(p=>{
    // Preserve seeded placement; remove only crowns touching the enlarged building or access path.
    const crown=({'tall-pine-a':1.9,'normal-pine-b':1.7,'round-tree-a':2.2,'young-tree-b':1,'bush-a':.95,lantern:.4}[p.kit])*p.scale
    const dx=Math.max(Math.abs(p.x-workshopPosition[0])-workshopSize.halfX*modelAssets.workshop.scale,0)
    const dz=Math.max(Math.abs(p.z-workshopPosition[2])-workshopSize.halfZ*modelAssets.workshop.scale,0)
    return clearForVegetation(p.x,p.z)&&Math.hypot(dx,dz)>crown+.2
  }).filter(p=>p.kit==='bush-a'||sightlines.every(([ax,az,bx,bz])=>{
    const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.z-az)*dz)/(dx*dx+dz*dz)))
    return Math.hypot(p.x-ax-dx*t,p.z-az-dz*t)>2.2
  }))
}
export const vegetationPositions=makeLayout()
/** Exported source circles are in physical kit space, before quantisation, just like our layout. */
export function instanceCircles(p:VegetationInstance) {
  return templates[p.kit].colliders.map(([x,z,r])=>({x:p.x+(Math.cos(p.yaw)*x+Math.sin(p.yaw)*z)*p.scale,z:p.z+(-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z)*p.scale,r:r*p.scale}))
}
export const vegetationColliders=[...vegetationPositions,...lampPositions].flatMap(instanceCircles)
