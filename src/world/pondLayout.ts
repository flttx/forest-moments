import * as THREE from 'three'
import { pond } from './worldConfig'
import { pondRadiusAt } from './pondShape'
import { terrainHeight } from './terrain'

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
/** The west bank is the fishing spot and the cast runs east from it, so reeds, pads and rocks keep clear of both. */
const fishingKeepOut = (x: number, z: number) => Math.hypot(x - 1.5, z + 5) < 2.4 || (x > 1.8 && x < 5.6 && Math.abs(z + 5) < 1.4)
const bankPoint = (angle: number, offset: number) => {
  const r = pondRadiusAt(angle) + offset
  return [pond.x + Math.cos(angle) * r, pond.z + Math.sin(angle) * r] as const
}

/** Reed stands, stones, lily pads and a few flowers around the pond, shared by rendering and collision. */
export const pondLayout = (() => {
  const random = rand(4421)
  const reeds: THREE.Matrix4[] = [], stones: THREE.Matrix4[] = [], pads: THREE.Matrix4[] = [], flowers: THREE.Matrix4[] = []
  const dummy = new THREE.Object3D()
  // reed clumps gather in a few stands rather than a uniform ring
  for (const [centre, spread, count] of [[0.2, 0.6, 7], [1.5, 0.45, 6], [-1.4, 0.5, 6], [2.4, 0.4, 4], [-2.2, 0.35, 4]] as const)
    for (let i = 0; i < count; i++) {
      const [x, z] = bankPoint(centre + (random() - 0.5) * spread * 2, -0.35 + random() * 0.75)
      if (fishingKeepOut(x, z)) continue
      dummy.position.set(x, terrainHeight(x, z) - 0.04, z); dummy.rotation.set(0, random() * 6.28, 0); dummy.scale.setScalar(0.8 + random() * 0.5)
      dummy.updateMatrix(); reeds.push(dummy.matrix.clone())
    }
  for (let i = 0; i < 18; i++) {
    const [x, z] = bankPoint(random() * Math.PI * 2, 0.15 + random() * 0.55)
    if (fishingKeepOut(x, z)) continue
    const s = 0.12 + random() * 0.2
    dummy.position.set(x, terrainHeight(x, z) + s * 0.1, z); dummy.rotation.set(random() * 0.3, random() * 6.28, random() * 0.3); dummy.scale.set(s * 1.3, s * 0.65, s)
    dummy.updateMatrix(); stones.push(dummy.matrix.clone())
  }
  for (let i = 0; i < 11; i++) {
    const [x, z] = bankPoint(random() * Math.PI * 2, -(0.5 + random() * 1.1))
    if (fishingKeepOut(x, z) || pads.some(m => Math.hypot(m.elements[12] - x, m.elements[14] - z) < 0.7)) continue
    const s = 0.22 + random() * 0.18
    dummy.position.set(x, pond.waterY + 0.014, z); dummy.rotation.set(-Math.PI / 2, 0, random() * 6.28); dummy.scale.setScalar(s)
    dummy.updateMatrix(); pads.push(dummy.matrix.clone())
    if (random() < 0.3) { dummy.position.set(x + 0.04, pond.waterY + 0.05, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.07 + random() * 0.03); dummy.updateMatrix(); flowers.push(dummy.matrix.clone()) }
  }
  return { reeds, stones, pads, flowers }
})()

/** Bank stones whose tops reach the raccoon's legs (higher than 0.15 m) are solid; flatter ones are stepped over. */
export const pondStoneColliders = pondLayout.stones.map(m => {
  const s = new THREE.Vector3().setFromMatrixScale(m).z
  return { x: m.elements[12], z: m.elements[14], r: 1.15 * s, top: 0.75 * s }
}).filter(c => c.top > 0.15)
