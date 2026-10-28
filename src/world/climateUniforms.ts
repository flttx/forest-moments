import * as THREE from 'three'

/**
 * Shared shader inputs for weather and season (plan X4). One object per input, referenced by every material that
 * reads it (terrain, grass, crowns), so the Climate component eases them all at once each frame.
 */
export const climateUniforms={
 climateBroadleaf:{value:new THREE.Vector3(1,1,1)},
 climatePine:{value:new THREE.Vector3(1,1,1)},
 climateGrass:{value:new THREE.Vector3(1,1,1)},
 climateWet:{value:0},
}
export const climateGLSL='uniform vec3 climateGrass;uniform float climateWet;\n'
/** Eased weather numbers for the sky, light, fog, rain and leaves (not shader uniforms); written by Climate. */
export const climateNow={overcast:0,light:1,fog:1,rain:0,leaves:0}
