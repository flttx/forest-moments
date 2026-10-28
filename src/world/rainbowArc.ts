import * as THREE from 'three'
import {seaLevel} from './worldConfig'

/** How far out the bow stands and how wide it is: from the island it fills about a third of the sky opposite the sun. */
export const rainbowDistance=300,rainbowRadius=170,rainbowWidth=16

/** Where the bow's centre sits for a sun direction: on the sea horizon, straight away from the sun. */
export function rainbowCentre(sun:THREE.Vector3){
 const away=new THREE.Vector3(-sun.x,0,-sun.z)
 if(away.lengthSq()<1e-6)away.set(0,0,-1)
 return away.normalize().multiplyScalar(rainbowDistance).setY(seaLevel)
}
