import {cabin,camp,seats,reefs,creekDistance,onBridge,bridgeHeight} from './expansion'
import { lookoutPosition, modelAssets, workshopPosition, workshopSize } from '../world/assets'
import { islandShape, terrainHeight } from '../world/terrain'
import { vegetationColliders } from '../world/vegetationLayout'
import {pondEdgeDistance} from '../world/pondShape'
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
const boxes = [
  {x:cabin.x,z:cabin.z,halfX:cabin.halfX,halfZ:cabin.halfZ},
  { x: workshopPosition[0], z: workshopPosition[2], halfX: workshopSize.halfX * modelAssets.workshop.scale, halfZ: workshopSize.halfZ * modelAssets.workshop.scale },
  // ponytail: conservative footprint until the stair walking surface is implemented.
  { x: lookoutPosition[0], z: lookoutPosition[2], halfX: 1.618776 * modelAssets.lookout.scale, halfZ: 2.14244 * modelAssets.lookout.scale },
  ...farmColliders,
]

export function canStandAt(x: number, z: number,treeRadius=0,workshopPhase:WorkshopBook['phase']='available'): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false
  if(animalObstacles.some(a=>Math.hypot(x-a.x,z-a.z)<radius+a.r))return false
  if(treeRadius>0&&Math.hypot(x-plantingSpot.x,z-plantingSpot.z)<radius+treeRadius)return false
  const wood=workshopPhase==='available'?woodSpot:null
  if(wood&&Math.hypot(x-wood.x,z-wood.z)<radius+.43)return false
  if(creekDistance(x,z)<1.45&&!onBridge(x,z,.28))return false
  if(Math.hypot(x-camp.x,z-camp.z)<1.05)return false
  if(reefs.some(r=>{const dx=x-r.x,dz=z-r.z,u=(dx*Math.cos(r.yaw)-dz*Math.sin(r.yaw))/(2*r.scale+.28),v=(dx*Math.sin(r.yaw)+dz*Math.cos(r.yaw))/(1.5*r.scale+.28);return u*u+v*v<1}))return false
  if(seats.some(s=>{const dx=x-s.x,dz=z-s.z;return Math.abs(dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw))<1.2&&Math.abs(dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw))<.53}))return false
  const onDock=isDockSurface(x,z,radius)
  if(!onDock&&!onBridge(x,z)){const h=terrainHeight(x,z);if(h<seaLevel+.16||Math.hypot(x,z)>islandShape.coastRadius+2)return false;const slope=Math.hypot(terrainHeight(x+.15,z)-terrainHeight(x-.15,z),terrainHeight(x,z+.15)-terrainHeight(x,z-.15))/.3;if(slope>.85)return false}
  if (!onDock && pondEdgeDistance(x,z)<radius) return false
  if(dockPosts.some(p=>Math.hypot(x-p.x,z-p.z)<radius+p.r))return false
  for (const box of boxes) {
    const dx = Math.max(Math.abs(x - box.x) - box.halfX, 0)
    const dz = Math.max(Math.abs(z - box.z) - box.halfZ, 0)
    if (Math.hypot(dx, dz) < radius) return false
  }
  return !vegetationColliders.some((p) => Math.hypot(x - p.x, z - p.z) < radius + p.r)
}

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
