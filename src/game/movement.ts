import {cabin,camp,seats,reefs,bridge,creekDistance,onBridge,bridgeHeight} from './expansion'
import { lookoutPosition, modelAssets, workshopPosition } from '../world/assets'
import { islandShape, terrainHeight, pathEdgeDistance } from '../world/terrain'
import { vegetationColliders, vegetationPositions, lampPositions, instanceCircles, lowFoliage } from '../world/vegetationLayout'
import {pondEdgeDistance} from '../world/pondShape'
import {pondStoneColliders} from '../world/pondLayout'
import {coastPieces,coastKits} from '../world/coastalLayout'
import {hayBales,logPile} from '../world/settlement'
import {coastalDock,dockPosts,isDockSurface,seaLevel} from '../world/worldConfig'
import {plantingSpot} from './growth'
import {farmColliders,animalObstacles} from './farm'
import {woodSpot,type WorkshopBook} from './workshop'

export interface GroundPoint { x: number; z: number }
const radius = .28
export const dockDeckHeight = coastalDock.deckY

export function groundHeightAt(x: number, z: number): number {
  return onBridge(x,z) ? bridgeHeight(z) : isDockSurface(x,z) ? dockDeckHeight : terrainHeight(x,z)
}
// Cabin and workshop footprints are measured from the drawn models in the raccoon's body band
// (scripts/audit_collisions.mjs), not from their bounding sizes, so walls stop the raccoon where they stand.
const boxes = [
  // Cabin: walls z -2.34..2.06 about its centre, with the door step and chimney (|x| < 1.2) out to -2.72..2.80.
  {name:'cabin',x:cabin.x,z:cabin.z-.14,halfX:3.15,halfZ:2.2},
  {name:'cabin',x:cabin.x,z:cabin.z+.04,halfX:1.2,halfZ:2.76},
  // Workshop: full width back to z 1.77 (the open west porch ends there), the front out to 2.78, the doorway block to 3.21.
  {name:'workshop',x:workshopPosition[0],z:workshopPosition[2]-.595,halfX:3.53,halfZ:2.365},
  {name:'workshop',x:workshopPosition[0]+.89,z:workshopPosition[2]-.09,halfX:2.64,halfZ:2.87},
  {name:'workshop',x:workshopPosition[0]+1,z:workshopPosition[2]+.125,halfX:1.75,halfZ:3.085},
  // ponytail: conservative footprint until the stair walking surface is implemented.
  { name:'lookout', x: lookoutPosition[0], z: lookoutPosition[2], halfX: 1.618776 * modelAssets.lookout.scale, halfZ: 2.14244 * modelAssets.lookout.scale },
  ...farmColliders,
  // Bridge railings and their flared end posts (0.91-1.34 m off the centre line); the deck between stays open.
  ...[-1,1].map(side=>({name:'bridge railing',x:bridge.x+side*1.125,z:bridge.z,halfX:.215,halfZ:bridge.halfZ})),
]
// Hay bales and the log pile, as turned rectangles (half sizes in metres along their own axes).
const rects=[...hayBales.map(b=>({name:'hay bale',x:b.x,z:b.z,yaw:b.yaw,hx:.5,hz:.29})),{name:'log pile',x:logPile.x,z:logPile.z,yaw:logPile.yaw,hx:.65,hz:.37},
  // Driftwood logs lie along their local x; only logs standing proud of the sand count.
  ...coastPieces.filter(p=>p.kit.startsWith('Driftwood')&&p.y+coastKits[p.kit].height*p.scale-terrainHeight(p.x,p.z)>.15).map(p=>({name:'driftwood',x:p.x,z:p.z,yaw:p.yaw,hx:coastKits[p.kit].half*p.scale,hz:.15*p.scale}))]
const rectDistance=(x:number,z:number,r:{x:number;z:number;yaw:number;hx:number;hz:number})=>{
  const dx=x-r.x,dz=z-r.z,c=Math.cos(r.yaw),s=Math.sin(r.yaw)
  return Math.hypot(Math.max(Math.abs(c*dx-s*dz)-r.hx,0),Math.max(Math.abs(s*dx+c*dz)-r.hz,0))
}
// Round solids: raised pond-bank stones; path-side stones are added below.
const rocks=pondStoneColliders.map(c=>({name:'pond stone',...c}))
/**
 * Solids whose reach depends on the slope: walking outward in 8 directions, each keeps blocking only while its height
 * span [bottom, top] still meets the raccoon's body (0.15-1.1 m above the ground at that point). A cliff rock stops at
 * the turf it is buried under; a pine skirt stops where the ground falls away far enough to walk beneath it; a high
 * crown only blocks uphill, where the ground rises to it.
 */
function profile(name:string,x:number,z:number,reach:number,bottom:number,top:number){
  const radii=Array.from({length:8},(_,i)=>{
    const a=i*Math.PI/4;let r=0
    // Farthest overlap, not the first gap: a crown may clear the head by the trunk yet meet the rising ground uphill.
    for(let d=.1;d<=reach+1e-6;d+=.1){const g=terrainHeight(x+Math.cos(a)*d,z+Math.sin(a)*d);if(top>=g+.15&&bottom<=g+1.1)r=d}
    return r
  })
  return{name,x,z,radii,max:Math.max(...radii)}
}
const profiles=[
  ...vegetationPositions.flatMap(p=>{const f=lowFoliage[p.kit];return f?[profile(`plant:${p.kit}`,p.x,p.z,f.reach*p.scale,terrainHeight(p.x,p.z)+f.base*p.scale,Infinity)]:[]}),
  ...coastPieces.filter(p=>!p.kit.startsWith('Driftwood')).map(p=>profile('coast rock',p.x,p.z,coastKits[p.kit].half*p.scale*.8,p.y,p.y+coastKits[p.kit].height*p.scale)),
  // Street lamps hang their lantern 0.62 m out from the post, 0.72-1.8 m up: head height for the raccoon.
  ...lampPositions.map(l=>{const post=instanceCircles(l)[0],dx=l.x-post.x,dz=l.z-post.z,n=Math.hypot(dx,dz)||1,g=terrainHeight(l.x,l.z)
    return profile('lamp head',post.x+dx/n*.62,post.z+dz/n*.62,.18,g+.72,g+1.8)}),
].filter(c=>c.max>0)
const profileHit=(x:number,z:number,c:typeof profiles[number])=>{
  const dx=x-c.x,dz=z-c.z,d=Math.hypot(dx,dz);if(d>=c.max+radius)return false
  const f=((Math.atan2(dz,dx)+Math.PI*2)%(Math.PI*2))/(Math.PI/4),i=Math.floor(f)%8,t=f-Math.floor(f)
  return d<c.radii[i]*(1-t)+c.radii[(i+1)%8]*t+radius
}
// Filled once the path stones below are placed (they are laid out with this very check).
let pathStoneColliders:{name:string;x:number;z:number;r:number}[]=[]

/** What keeps the raccoon from standing here, or null when it can. Labels feed scripts/audit_collisions.mjs. */
export function standBlocker(x: number, z: number,treeRadius=0,workshopPhase:WorkshopBook['phase']='available'): string|null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 'invalid'
  if(animalObstacles.some(a=>Math.hypot(x-a.x,z-a.z)<radius+a.r))return 'animal'
  if(treeRadius>0&&Math.hypot(x-plantingSpot.x,z-plantingSpot.z)<radius+treeRadius)return 'planted tree'
  const wood=workshopPhase==='available'?woodSpot:null
  if(wood&&Math.hypot(x-wood.x,z-wood.z)<radius+.43)return 'old stump'
  if(creekDistance(x,z)<1.45&&!onBridge(x,z,.28))return 'terrain:creek'
  if(Math.hypot(x-camp.x,z-camp.z)<1.05)return 'campfire'
  // Each reef's ellipse fits the rock that stands above its own patch of sand (foot: u0,u1,w0,w1 in its frame).
  if(reefs.some(r=>{const dx=x-r.x,dz=z-r.z,[u0,u1,w0,w1]=r.foot,u=(dx*Math.cos(r.yaw)-dz*Math.sin(r.yaw)-(u0+u1)/2)/((u1-u0)/2+radius),v=(dx*Math.sin(r.yaw)+dz*Math.cos(r.yaw)-(w0+w1)/2)/((w1-w0)/2+radius);return u*u+v*v<1}))return 'reef'
  const rect=rects.find(r=>rectDistance(x,z,r)<radius);if(rect)return rect.name
  const rock=[...rocks,...pathStoneColliders].find(r=>Math.hypot(x-r.x,z-r.z)<radius+r.r);if(rock)return rock.name
  if(seats.some(s=>{const dx=x-s.x,dz=z-s.z;return Math.abs(dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw))<1.2&&Math.abs(dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw))<.53}))return 'bench'
  const onDock=isDockSurface(x,z,radius)
  if(!onDock&&!onBridge(x,z)){const h=terrainHeight(x,z);if(h<seaLevel+.16||Math.hypot(x,z)>islandShape.coastRadius+2)return 'terrain:water';const slope=Math.hypot(terrainHeight(x+.15,z)-terrainHeight(x-.15,z),terrainHeight(x,z+.15)-terrainHeight(x,z-.15))/.3;if(slope>.85)return 'terrain:slope'}
  if (!onDock && pondEdgeDistance(x,z)<radius) return 'terrain:pond'
  if(dockPosts.some(p=>Math.hypot(x-p.x,z-p.z)<radius+p.r))return 'dock post'
  for (const box of boxes) {
    const dx = Math.max(Math.abs(x - box.x) - box.halfX, 0)
    const dz = Math.max(Math.abs(z - box.z) - box.halfZ, 0)
    if (Math.hypot(dx, dz) < radius) return `box:${box.name}`
  }
  const plant=vegetationColliders.find((p) => Math.hypot(x - p.x, z - p.z) < radius + p.r)
  if(plant)return `plant:${plant.kit}`
  return profiles.find(c=>profileHit(x,z,c))?.name??null
}
export function canStandAt(x: number, z: number,treeRadius=0,workshopPhase:WorkshopBook['phase']='available'): boolean {
  return standBlocker(x,z,treeRadius,workshopPhase)===null
}

/** Decorative stones beside the trails, kept off paths, pads and other solids; each is solid itself afterwards. */
export const pathStones = Array.from({ length: 36 }, (_, i) => {
  const a = i * 2.399
  const r = 9 + ((i * 11) % 17) * .5
  return [Math.sin(a) * r, Math.cos(a) * r] as const
}).filter(([x, z]) => canStandAt(x, z) && groundHeightAt(x, z) === 0 && pathEdgeDistance(x,z)>.45)
pathStoneColliders=pathStones.map(([x,z])=>({name:'path stone',x,z,r:.3}))

/** Short steps prevent tunnelling; independent axes allow sliding along walls. */
export function moveOnGround(start: GroundPoint, dx: number, dz: number,treeRadius=0,workshopPhase:WorkshopBook['phase']='available'): GroundPoint {
  if (![dx, dz, start.x, start.z].every(Number.isFinite)) return { ...start }
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12))
  let { x, z } = start
  for (let i = 0; i < count; i++) {
    if (canStandAt(x + dx / count, z,treeRadius,workshopPhase)) x += dx / count
    if (canStandAt(x, z + dz / count,treeRadius,workshopPhase)) z += dz / count
  }
  return { x, z }
}
