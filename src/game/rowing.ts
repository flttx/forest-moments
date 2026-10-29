import {berths,mooring,seaLevel,seaRangeRadius,oceanNavigation} from '../world/worldConfig'
import {terrainHeight} from '../world/terrain'
export {pond,mooring,landing} from '../world/worldConfig'
export const paddleDuration = 7.2

export interface BoatState {
  x: number
  z: number
  heading: number
  speed: number
  phase: number
  effort: number
}
export const initialBoat: BoatState = { ...mooring, speed: 0, phase: 0, effort: 0 }

export function seaBoundaryClearance(x:number,z:number){return seaRangeRadius(Math.atan2(z,x))-Math.hypot(x,z)-1.8}
export function isNavigableSea(x:number,z:number){
  return Math.hypot(x,z)<=seaRangeRadius(Math.atan2(z,x))&&terrainHeight(x,z)<=seaLevel-oceanNavigation.minDepth
}

/** Sample the hull perimeter and centre against coastal depth and the island-following outer limit. */
export function boatFits(x: number, z: number, heading: number): boolean {
  if (![x, z, heading].every(Number.isFinite)) return false
  const c = Math.cos(heading), s = Math.sin(heading)
  // Also exclude the part of the dock that extends over the water. A conservative
  // world box keeps the hull clear of the deck during near-shore turns.
  const halfX = 1.7 * Math.abs(c) + .57 * Math.abs(s)
  const halfZ = 1.7 * Math.abs(s) + .57 * Math.abs(c)
  if(Object.values(berths).some(({dock:d})=>x+halfX>d.minX&&x-halfX<d.maxX&&z+halfZ>d.minZ&&z-halfZ<d.maxZ))return false
  return [-1.7,0,1.7].every((along) => [-.57,0,.57].every((across) =>
    isNavigableSea(x+along*c+across*s,z-along*s+across*c)))
}

export function landingBerth(boat:BoatState){return Object.values(berths).find(({mooring:m})=>Math.hypot(boat.x-m.x,boat.z-m.z)<.85&&Math.abs(boat.speed)<.18&&Math.abs(Math.sin(boat.heading-m.heading))<.35)}
export function canLand(boat: BoatState): boolean {return !!landingBerth(boat)}

export function canBoard(x: number, z: number, boat: BoatState): boolean {
  const berth=landingBerth(boat)
  return !!berth&&Math.hypot(x-berth.landing.x,z-berth.landing.z)<.8
}

/** Coastal kinematic controller: short steps protect the hull, no rigid-body simulation. */
export function stepBoat(boat: BoatState, forward: number, turn: number, delta: number): BoatState {
  if (![forward, turn, delta].every(Number.isFinite)) return boat
  const dt = Math.max(0, Math.min(delta, .05))
  const thrust = Math.max(-1, Math.min(1, forward))
  const steer = Math.max(-1, Math.min(1, turn))
  const speed = boat.speed + (thrust * (thrust < 0 ? .65 : 1.05) - boat.speed) * (1 - Math.exp(-4 * dt))
  const angle = boat.heading + steer * .8 * dt
  const heading = boatFits(boat.x, boat.z, angle) ? Math.atan2(Math.sin(angle), Math.cos(angle)) : boat.heading
  const x = boat.x + Math.cos(heading) * speed * dt
  const z = boat.z - Math.sin(heading) * speed * dt
  const allowed = boatFits(x, z, heading)
  const effort = Math.max(Math.abs(speed), Math.abs(steer) * .65)
  const phase = (boat.phase + (thrust < 0 ? -1 : 1) * effort * dt + paddleDuration) % paddleDuration
  return { x: allowed ? x : boat.x, z: allowed ? z : boat.z, heading, speed: allowed ? speed : 0, effort, phase }
}
