/** Runtime transforms only. Source geometry, clothes, tail and animation tracks stay intact. */
export const modelAssets = {
  raccoon: { url: '/assets/models/raccoon.glb', scale: 1.4 / .6, lift: .3 },
  workshop: { url: '/assets/models/workshop.glb', scale: 1.25, lift: 2.2749598026275635 },
  lookout: { url: '/assets/models/lookout.glb', scale: 6.8 / 6, lift: 3 },
  canoe: { url: '/assets/models/canoe-center-seat.glb', scale: .5, lift: 0 },
} as const

// Decoded GLB dimensions in metres, before the runtime scale.
export const workshopSize={halfX:3,halfZ:2.568422,height:4.5499196} as const
export const workshopPathOffset=(modelAssets.workshop.scale-.85)*workshopSize.halfZ

export {workshopPosition,lookoutPosition} from './worldConfig'

export const pinePositions = Array.from({ length: 66 }, (_, i) => {
  const a = i * 2.3999632
  const r = 11 + ((i * 29) % 22) * .31
  return { x: Math.sin(a) * r, z: Math.cos(a) * r, scale: .78 + (i % 6) * .11 }
}).filter(({ x, z }) => !(x < -5 && z > -10 && z < 6) && !(x > 3 && z > -10 && z < 9))
