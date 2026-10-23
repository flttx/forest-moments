import { lookoutPosition, modelAssets, pinePositions, workshopPosition } from '../world/assets'
import { pond } from './rowing'

export interface GroundPoint { x: number; z: number }
const radius = .28
export const dockDeckHeight = .12

export function groundHeightAt(x: number, z: number): number {
  return x >= 8.75 && x <= 11.55 && z >= -8.75 && z <= -7.55 ? dockDeckHeight : 0
}
const boxes = [
  { x: workshopPosition[0], z: workshopPosition[2], halfX: 3 * modelAssets.workshop.scale, halfZ: 2.568422 * modelAssets.workshop.scale },
  // ponytail: conservative footprint until the stair walking surface is implemented.
  { x: lookoutPosition[0], z: lookoutPosition[2], halfX: 1.618776 * modelAssets.lookout.scale, halfZ: 2.14244 * modelAssets.lookout.scale },
  { x: 8, z: 6, halfX: .775, halfZ: .675 },
]

export function canStandAt(x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) > 16.4) return false
  const onDock = x >= 8.75 + radius && x <= 11.55 - radius && z >= -8.75 + radius && z <= -7.55 - radius
  if (!onDock && Math.hypot(x - pond.x, z - pond.z) < pond.radius + radius) return false
  for (const box of boxes) {
    const dx = Math.max(Math.abs(x - box.x) - box.halfX, 0)
    const dz = Math.max(Math.abs(z - box.z) - box.halfZ, 0)
    if (Math.hypot(dx, dz) < radius) return false
  }
  return !pinePositions.some((p) => Math.hypot(x - p.x, z - p.z) < radius + .25 * p.scale)
}

/** Short steps prevent tunnelling; independent axes allow sliding along walls. */
export function moveOnGround(start: GroundPoint, dx: number, dz: number): GroundPoint {
  if (![dx, dz, start.x, start.z].every(Number.isFinite)) return { ...start }
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12))
  let { x, z } = start
  for (let i = 0; i < count; i++) {
    if (canStandAt(x + dx / count, z)) x += dx / count
    if (canStandAt(x, z + dz / count)) z += dz / count
  }
  return { x, z }
}
