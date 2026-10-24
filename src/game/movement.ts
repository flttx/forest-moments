import { lookoutPosition, modelAssets, workshopPosition, workshopSize } from '../world/assets'
import { islandShape, terrainHeight } from '../world/terrain'
import { vegetationColliders } from '../world/vegetationLayout'
import {pondEdgeDistance} from '../world/pondShape'
import {coastalDock,dockPosts,isDockSurface,isBeachApproach,seaLevel} from '../world/worldConfig'
import {plantingSpot} from './growth'
import {farmColliders,animalObstacles} from './farm'
import {woodSpot,type WorkshopBook} from './workshop'

export interface GroundPoint { x: number; z: number }
const radius = .28
export const dockDeckHeight = coastalDock.deckY

export function groundHeightAt(x: number, z: number): number {
  return isDockSurface(x,z) ? dockDeckHeight : terrainHeight(x,z)
}
const boxes = [
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
  const onDock=isDockSurface(x,z,radius)
  if(!onDock&&Math.hypot(x,z)>islandShape.walkRadius&&!(isBeachApproach(x,z)&&terrainHeight(x,z)>seaLevel+.13))return false
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
