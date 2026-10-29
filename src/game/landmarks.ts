import {cabin,camp} from './expansion'
import {workshopPosition,lookoutPosition,landing} from '../world/worldConfig'
import {woodSpot,workshopDoor} from './workshop'
import {launchStand} from './lanterns'
import {berths} from '../world/worldConfig'
import {mistPine} from '../world/mistIsland'
/** Names and hints are translated by id (i18n `place.<id>`, `place.<id>.hint`). */
export const landmarks = [
  {id:'bedroom',x:cabin.x,z:cabin.doorZ},
  {id:'campfire',x:camp.x,z:camp.z},
  { id: 'workshop', x: workshopPosition[0], z: workshopPosition[2] },
  { id: 'farm', x: 8, z: 6 },
  { id: 'pond', x: 1.5, z: -5 },
  { id: 'lookout', x: lookoutPosition[0], z: lookoutPosition[2] },
  { id: 'grove', x: 0, z: 8 },
  { id: 'dock', x: landing.x, z: landing.z },
  {id:'lanterns',x:launchStand.x,z:launchStand.z},
  {id:'mist',...berths.mist.landing},
  {id:'mistPine',x:mistPine.x,z:mistPine.z+3.6},
] as const

export type LandmarkId = (typeof landmarks)[number]['id']

export function findNearestLandmark(x: number, z: number, radius = 3.1): LandmarkId | null {
  if(Math.hypot(x-woodSpot.x,z-woodSpot.z)<1.6||Math.hypot(x-workshopDoor.x,z-workshopDoor.z)<2.1)return'workshop'
  let nearest: LandmarkId | null = null
  let best = radius
  for (const point of landmarks) {
    const distance = Math.hypot(point.x - x, point.z - z)
    if (distance < best) {
      best = distance
      nearest = point.id
    }
  }
  return nearest
}
