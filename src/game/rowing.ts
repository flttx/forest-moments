export const pond = { x: 6, z: -5, radius: 4.05, waterY: .035 }
export const mooring = { x: 8.1, z: -6.1, heading: -Math.PI / 2 }
export const landing = { x: 9.3, z: -8.15 }
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

/** Conservative hull rectangle, including the bow/stern; the paddle may reach the bank. */
export function boatFits(x: number, z: number, heading: number): boolean {
  if (![x, z, heading].every(Number.isFinite)) return false
  const c = Math.cos(heading), s = Math.sin(heading)
  // Also exclude the part of the dock that extends over the water. A conservative
  // world box keeps the hull clear of the deck during near-shore turns.
  const halfX = 1.7 * Math.abs(c) + .57 * Math.abs(s)
  const halfZ = 1.7 * Math.abs(s) + .57 * Math.abs(c)
  if (x + halfX > 8.75 && x - halfX < 11.55 && z + halfZ > -8.75 && z - halfZ < -7.55) return false
  return [-1.7, 1.7].every((along) => [-.57, .57].every((across) =>
    Math.hypot(x + along * c + across * s - pond.x, z - along * s + across * c - pond.z) <= pond.radius - .04))
}

export function canLand(boat: BoatState): boolean {
  return Math.hypot(boat.x - mooring.x, boat.z - mooring.z) < .7 && Math.abs(boat.speed) < .18
}

export function canBoard(x: number, z: number, boat: BoatState): boolean {
  return Math.hypot(x - landing.x, z - landing.z) < .8 && canLand(boat)
}

/** Kinematic pond controller: short steps protect the hull, no rigid-body simulation. */
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
