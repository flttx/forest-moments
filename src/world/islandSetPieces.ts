/**
 * Wayfinding on the neighbour islands (archipelago stage 4): the main island's wooden signpost where each dock meets
 * its trail, the board turned to face whoever steps off the boat. Benches live with the other seats (expansion.ts),
 * lamps with the other lanterns (vegetationLayout.ts). Plain data: movement reads it for the colliders.
 */
export const islandSigns=[
 {island:'mist',x:88.78,z:-11.39,yaw:-.129},
 {island:'autumn',x:95.6,z:49.7,yaw:0},
 {island:'tide',x:87.03,z:98.97,yaw:.261},
] as const
/** The same footprint as the workshop signpost on the main island (furniture.ts). */
export const signHalf={hx:.58,hz:.12} as const
