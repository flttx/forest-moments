import { camp } from '../game/expansion'
import { workshopDoor } from '../game/workshop'

/** Ground worn down by daily use: soil shows through the turf and sand around these working spots (ellipse radii in metres). */
export const trampledSpots = [
  { x: camp.x, z: camp.z, rx: 3.2, rz: 2.8 },
  { x: 8, z: 6, rx: 4.1, rz: 3.4 },
  { x: workshopDoor.x, z: workshopDoor.z, rx: 2.4, rz: 1.5 },
  { x: 1.5, z: -5, rx: 1.5, rz: 1.3 },
] as const

export const trampleGLSL = /* glsl */ `
float trampleAt(vec2 p){
 float t=0.0;
 ${trampledSpots.map(s => `t=max(t,1.0-smoothstep(.5,1.0,length((p-vec2(${s.x.toFixed(2)},${s.z.toFixed(2)}))/vec2(${s.rx.toFixed(2)},${s.rz.toFixed(2)}))+(noise21(p*1.3)-.5)*.4));`).join(' ')}
 return t;
}
`

/** Hay bales beside the farm fence and a log pile by the workshop; decorative, placed clear of every path and interaction pad. */
export const hayBales = [
  { x: 12.4, z: 4.6, y: 0, yaw: 0.3 },
  { x: 12.95, z: 5.45, y: 0, yaw: -0.2 },
  { x: 12.6, z: 5.0, y: 0.5, yaw: 0.1 },
] as const
export const logPile = { x: workshopDoor.x - 5.2, z: workshopDoor.z - 5.4, yaw: 0.2 }
