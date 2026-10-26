import * as THREE from 'three'
import { vegetationPositions } from './vegetationLayout'
import { canopyMapExtent } from './terrain'

const SIZE = 160
const CROWN: Record<string, number> = { 'tall-pine-a': 2.6, 'normal-pine-b': 2.4, 'round-tree-a': 3, 'young-tree-b': 1.6, 'bush-a': 1 }
const density = new Float32Array(SIZE * SIZE)
for (const p of vegetationPositions) {
  const radius = (CROWN[p.kit] ?? 0) * p.scale
  if (!radius) continue
  const cx = (p.x / canopyMapExtent + 0.5) * SIZE, cz = (p.z / canopyMapExtent + 0.5) * SIZE, span = (radius / canopyMapExtent) * SIZE
  const strength = p.kit === 'bush-a' ? 0.35 : 1
  for (let j = Math.max(0, Math.floor(cz - span)); j <= Math.min(SIZE - 1, Math.ceil(cz + span)); j++)
    for (let i = Math.max(0, Math.floor(cx - span)); i <= Math.min(SIZE - 1, Math.ceil(cx + span)); i++) {
      const t = Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / span
      if (t >= 1) continue
      const a = strength * (1 - t * t) ** 1.5
      density[j * SIZE + i] = 1 - (1 - density[j * SIZE + i]) * (1 - a)
    }
}
/** Crown shade 0..1 at a world position, matching the texture the ground shaders sample. */
export function canopyDensityAt(x: number, z: number): number {
  const i = Math.floor((x / canopyMapExtent + 0.5) * SIZE), j = Math.floor((z / canopyMapExtent + 0.5) * SIZE)
  return i < 0 || j < 0 || i >= SIZE || j >= SIZE ? 0 : density[j * SIZE + i]
}
let texture: THREE.DataTexture | undefined
/** Shared by terrain and grass; row j is world z so the shader can sample with p / extent + .5. */
export function canopyTexture(): THREE.DataTexture {
  if (texture) return texture
  const data = new Uint8Array(SIZE * SIZE * 4)
  for (let k = 0; k < SIZE * SIZE; k++) data.set([Math.round(density[k] * 255), 0, 0, 255], k * 4)
  texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}
