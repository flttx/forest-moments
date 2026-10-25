// Stable tree colour variation without proximity or camera-dependent fading.
import * as THREE from 'three'
import { noiseGLSL } from './terrain'
// P14 C5: neighbouring groves lean yellow-green or blue-green and each tree is a little lighter or darker, so one pine
// kit no longer reads as a uniform carpet. Keyed on the instance's world position (stable across chunks and the LOD
// twin, which share these materials); only leaf colours are tinted, not trunks or bark.
const VARIATION_VERTEX_PARS = /* glsl */ `
  varying vec3 vFoliageTint;
  ${noiseGLSL}
`;
const VARIATION_VERTEX = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 foliageRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 foliageRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  float foliageGrove = noise21(foliageRoot.xz * 0.06 + 7.0);
  // value noise sits near 0.5 most of the time: a narrow ramp so groves really land on one side or the other
  vec3 foliageHue = mix(vec3(0.8, 0.96, 1.12), vec3(1.22, 1.08, 0.7), smoothstep(0.42, 0.58, foliageGrove));
  vFoliageTint = foliageHue * (0.78 + 0.36 * hash21(foliageRoot.xz * 0.73 + 3.1));
`;
const VARIATION_FRAGMENT = /* glsl */ `
  // leaves only: the brown trunks and bark (red well above green) keep their colour; olive pine needles count as leaves
  diffuseColor.rgb *= mix(vec3(1.0), vFoliageTint, smoothstep(-0.05, 0.0, diffuseColor.g - diffuseColor.r));
`;

export function patchFoliageMaterial(material: THREE.Material) {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VARIATION_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VARIATION_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFoliageTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n${VARIATION_FRAGMENT}`);
  };
  material.customProgramCacheKey=()=> 'opaque-foliage-tint-v1';
  material.needsUpdate = true;
}
