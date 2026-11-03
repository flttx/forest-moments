import * as THREE from 'three'
import { groundHeightAt } from '../game/movement'
import { vegetationPositions } from './vegetationLayout'
import islandTemplates from './island-tree-templates.json'

/** The Autumn Isle maple clearing, kept open of trees and shrubs (vegetationLayout). */
export const clearing = { x: 110, z: 47 } as const
export const fleeRadius = 3.5, settleRadius = 7, hopSeconds = .22

/**
 * Perches in the real crowns round the clearing: for each bird, the nearest maple or birch in its direction, on the side
 * facing the clearing, a little inside the outer leaves of the lower crown (a bird there reads as sitting in the tree).
 */
export function perchFor(angle: number) {
  const trees = vegetationPositions.filter(p => (p.kit === 'ie-maple' || p.kit === 'ie-birch') && Math.hypot(p.x - clearing.x, p.z - clearing.z) < 11)
  const tree = trees.sort((a, b) => {
    const off = (p: typeof a) => Math.abs(Math.atan2(Math.sin(Math.atan2(p.z - clearing.z, p.x - clearing.x) - angle), Math.cos(Math.atan2(p.z - clearing.z, p.x - clearing.x) - angle)))
    return off(a) - off(b)
  })[0]
  const crown = islandTemplates[tree.kit as 'ie-maple' | 'ie-birch'].crown, toward = Math.atan2(clearing.z - tree.z, clearing.x - tree.x)
  const out = crown.r * tree.scale * .8
  return new THREE.Vector3(tree.x + Math.cos(toward) * out, groundHeightAt(tree.x, tree.z) + (crown.y - crown.r * .4) * tree.scale, tree.z + Math.sin(toward) * out)
}

