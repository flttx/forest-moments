import {cabin,camp,seats,creekDistance} from '../game/expansion'
import {modelAssets,workshopSize,workshopPathOffset} from './assets'
import originalTemplates from './vegetation-templates.json'
import islandTemplates from './island-tree-templates.json'
const templates={...originalTemplates,...islandTemplates}
import { originalPathDistance as pathDistance, islandShape, terrainHeight } from './terrain'
import {westLandRadius,westTrailDistance,westWetlandRadius} from './westExpansion'
import {mistRadius,mistPathDistance,mistPine} from './mistIsland'
import {workshopPosition,lookoutPosition,lookoutHill,isBeachApproach,clearings} from './worldConfig'

export type PlantKit = keyof typeof templates
export interface VegetationInstance { kit: PlantKit; x: number; z: number; scale: number; yaw: number }
/**
 * Foliage low enough to meet the raccoon (kit space): reach is the measured body-band radius less 8 cm, so only the
 * outer needles brush the body; base is the lowest leaves above the trunk foot. Movement turns these into per-direction
 * colliders against the actual slope. Kits not listed are trunk-only.
 */
export const lowFoliage:Partial<Record<PlantKit,{reach:number;base:number}>>={'normal-pine-b':{reach:1.5,base:.78},'young-tree-b':{reach:.79,base:.74},'bush-a':{reach:.74,base:0},'round-tree-a':{reach:1.9,base:2.06}}
const originalLampPositions: VegetationInstance[] = [
  [-4.1,-2.5,0],[-8.6,13.1,.5],[15.8,-3.4,Math.PI],
  ...[-2.8,-1.9,-1,.25,.9,1.8,2.7].map(a=>[Math.cos(a)*22.1,Math.sin(a)*22.1,-a]),
].map(([x,z,yaw])=>({kit:'lantern',x,z,yaw,scale:1.3}))

export const lampPositions=originalLampPositions.map(p=>{
 const start=p.x===-8.6?{...p,z:13.6}:p
 for(let radius=0;radius<5;radius+=.25)for(let a=0;a<Math.PI*2;a+=Math.PI/12){
  const candidate={...start,x:start.x+Math.cos(a)*radius,z:start.z+Math.sin(a)*radius}
  if(instanceCircles(candidate).every(c=>pathDistance(c.x,c.z)-c.r>1.3)&&creekDistance(candidate.x,candidate.z)>3)return candidate
 }
 return start
})

/** Generous canopy buffers around gameplay and entrances, in metres. */
export function clearForVegetation(x:number,z:number,margin=0,pathOffset=workshopPathOffset) {
  if(x>72)return mistRadius(x,z)<.85&&terrainHeight(x,z)>.5&&mistPathDistance(x,z)>2.1+margin
  if(x< -35.5)return westLandRadius(x,z)<.79&&terrainHeight(x,z)>.6&&westTrailDistance(x,z)>2.7+margin&&westWetlandRadius(x,z)>1.65
  if(Math.hypot(x,z)>islandShape.walkRadius-.3-margin) return false
  if(x>19&&Math.abs(z-1.4)<1.5+margin)return false
  if(Math.hypot(terrainHeight(x+.3,z)-terrainHeight(x-.3,z),terrainHeight(x,z+.3)-terrainHeight(x,z-.3))/.6>.7)return false
  if(isBeachApproach(x,z)||creekDistance(x,z)<2.8+margin||Math.hypot(x-cabin.x,z-cabin.z)<5.4+margin||Math.hypot(x-camp.x,z-camp.z)<5+margin||seats.some(s=>Math.hypot(x-s.x,z-s.z)<3+margin))return false
  if(pathDistance(x,z,pathOffset)<1.5+margin) return false
  const exclusions=[[workshopPosition[0],workshopPosition[2],4.9],[lookoutPosition[0],lookoutPosition[2],4.7],[lookoutHill.x,lookoutHill.z,4.7],[8,6,4.4],[6,-5,6.1],[0,8,2.8],[0,0,3.2],[1.5,-5,2.4],[8,8,2.8]]
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
  // Keep the pond/boarding and farm approach sightlines open with permanently visible trees.
  // Filter after sampling so thinning a foreground tree never relocates another trunk onto an existing route.
  const sightlines=[[15,13,8,6],[14,4,6,-5],[-4,17,-12,8]]
  return plants.filter(p=>{
    // Preserve seeded placement; remove only crowns touching the enlarged building or access path.
    const crown=({'tall-pine-a':1.9,'normal-pine-b':1.7,'round-tree-a':2.2,'young-tree-b':1,'bush-a':.95,lantern:.4,'ie-old-pine':3.9,'ie-spruce':1.8}[p.kit])*p.scale
    const dx=Math.max(Math.abs(p.x-workshopPosition[0])-workshopSize.halfX*modelAssets.workshop.scale,0)
    const dz=Math.max(Math.abs(p.z-workshopPosition[2])-workshopSize.halfZ*modelAssets.workshop.scale,0)
    return clearForVegetation(p.x,p.z)&&Math.hypot(dx,dz)>crown+.2
  }).filter(p=>p.kit==='bush-a'||sightlines.every(([ax,az,bx,bz])=>{
    const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.z-az)*dz)/(dx*dx+dz*dz)))
    return Math.hypot(p.x-ax-dx*t,p.z-az-dz*t)>2.2
  }))
}
const originalPlants=makeLayout()
const outerPlants:VegetationInstance[]=[]
for(let i=0;i<700;i++){
 const a=i*2.399963,r=24+(i*17%100)/10,x=Math.cos(a)*r,z=Math.sin(a)*r
 if(!clearForVegetation(x,z,.6)||outerPlants.some(p=>Math.hypot(x-p.x,z-p.z)<3.6))continue
 outerPlants.push({kit:i%7===0?'round-tree-a':'normal-pine-b',x,z,yaw:a,scale:.85+(i%4)*.09})
}
// Meadow clearings: trees stay out entirely, bushes only keep to the outer ring so the edge reads as a shrubby fringe.
const inClearing=(p:VegetationInstance)=>clearings.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.r*(p.kit==='bush-a'?.7:1))
export const originalVegetationPositions=[...originalPlants,...outerPlants].filter(p=>p.z<26+Math.sin(p.x*.22)*1.2&&!inClearing(p))
// Reference-driven AHOLO trees replace the first trial's old-tree proxies in the western forest.
const westPlants:VegetationInstance[]=[]
for(let x=-76;x< -36;x+=3.2)for(let z=-10;z<35;z+=3.2){
 const n=Math.sin(x*13.1+z*17.7)*43758.5,f=n-Math.floor(n),px=x+(f-.5)*.7,pz=z+(.5-f)*.6
 if(!clearForVegetation(px,pz,.25))continue
 const kit=f<.08?'ie-old-pine':'ie-spruce',scale=kit==='ie-old-pine'?.86:.8+f*.2
 if(kit==='ie-old-pine'&&westTrailDistance(px,pz)<4.3)continue
 westPlants.push({kit,x:px,z:pz,scale,yaw:f*Math.PI*2})
 const bx=px+1.4,bz=pz+1.3
 if(f<.55&&clearForVegetation(bx,bz))westPlants.push({kit:f<.22?'ie-spruce':'bush-a',x:bx,z:bz,scale:f<.22?.45:.65+f*.3,yaw:f*5})
}
const mistPlants:VegetationInstance[]=[{kit:'ie-old-pine',...mistPine,scale:.92,yaw:1.1}]
for(let x=88;x<128;x+=3.1)for(let z=-28;z<10;z+=3.1){
 const f=(Math.sin(x*13.1+z*7.3)*43758.5)%1,px=x+f*.6,pz=z-f*.7
 if(!clearForVegetation(px,pz,.3)||Math.hypot(px-mistPine.x,pz-mistPine.z)<5.4)continue
 mistPlants.push({kit:'ie-spruce',x:px,z:pz,scale:.76+Math.abs(f)*.22,yaw:f*6})
}
export const vegetationPositions=[...originalVegetationPositions,...westPlants,...mistPlants]
/** Exported source circles are in physical kit space, before quantisation, just like our layout. */
export function instanceCircles(p:VegetationInstance) {
  return templates[p.kit].colliders.map(([x,z,r])=>({x:p.x+(Math.cos(p.yaw)*x+Math.sin(p.yaw)*z)*p.scale,z:p.z+(-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z)*p.scale,r:r*p.scale,kit:p.kit}))
}
export const vegetationColliders=[...vegetationPositions,...lampPositions].flatMap(instanceCircles)

// Approximate foliage volumes in kit space (template heights 4-8 m). Bushes count too: a low or close
// camera arm otherwise ends inside one and the view fills with leaves.
const crownShape:Partial<Record<PlantKit,{y:number;r:number}>>={'normal-pine-b':{y:3,r:2.1},'tall-pine-a':{y:4.2,r:2.4},'round-tree-a':{y:3.7,r:2},'young-tree-b':{y:2.7,r:1.4},'bush-a':{y:.55,r:.9},'ie-old-pine':islandTemplates['ie-old-pine'].crown,'ie-spruce':islandTemplates['ie-spruce'].crown}
/** Crown spheres used only to keep the camera out of leaves; rendering and collisions are unaffected. */
export const canopySpheres=vegetationPositions.flatMap(p=>{const c=crownShape[p.kit];return c?[{x:p.x,y:terrainHeight(p.x,p.z)+c.y*p.scale,z:p.z,r:c.r*p.scale}]:[]})
