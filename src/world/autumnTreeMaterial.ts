import * as THREE from 'three'
import {climateUniforms} from './climateUniforms'

/** Painted green/yellow/orange leaves share one seasonal palette. Neutral bark keeps its texture.
 * A chroma/height mask is intentionally local to these two generated broadleaf assets.
 */
export function patchAutumnTreeMaterial(material:THREE.Material,kind:'birch'|'maple'){
 if(!(material instanceof THREE.MeshStandardMaterial))return
 material.onBeforeCompile=shader=>{
  shader.uniforms.climateSeason=climateUniforms.climateBroadleaf
  shader.uniforms.climateTurn=climateUniforms.climateTurn
  shader.uniforms.treeMaskRange={value:kind==='birch'?new THREE.Vector2(.22,.46):new THREE.Vector2(.56,.7)}
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying float vTreeHeight;\nvarying float vTreeVariation;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vTreeHeight=position.y;
    #ifdef USE_INSTANCING
     vec3 treeRoot=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
    #else
     vec3 treeRoot=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
    #endif
    vTreeVariation=fract(sin(dot(treeRoot.xz,vec2(12.9898,78.233)))*43758.5453);
   `)
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\nvarying float vTreeHeight;\nvarying float vTreeVariation;\nuniform vec3 climateSeason;\nuniform float climateTurn;\nuniform vec2 treeMaskRange;')
   .replace('#include <map_fragment>',`#include <map_fragment>
    // Classify in approximate perceptual colour: linear-space saturation also catches brown bark.
    vec3 treePaint=sqrt(max(diffuseColor.rgb,vec3(0.0)));
    float treeMax=max(treePaint.r,max(treePaint.g,treePaint.b));
    float treeMin=min(treePaint.r,min(treePaint.g,treePaint.b));
    float treeSaturation=(treeMax-treeMin)/max(treeMax,0.001);
    float treeLeaf=smoothstep(0.02,0.06,(treePaint.g-treePaint.b)/max(treeMax,0.001))
      *smoothstep(treeMaskRange.x,treeMaskRange.y,treeSaturation)*smoothstep(0.7,1.2,vTreeHeight);
    float treeLight=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11));
    vec3 treeGreen=vec3(0.58,0.86,0.28)*treeLight*1.25*climateSeason;
    vec3 treeAutumn=mix(vec3(0.92,0.32,0.075),vec3(1.05,0.71,0.16),vTreeVariation)*treeLight*1.7;
    vec3 treeSeason=mix(treeGreen,treeAutumn,climateTurn*(0.7+0.3*vTreeVariation));
    diffuseColor.rgb=mix(diffuseColor.rgb,treeSeason,treeLeaf);
   `)
 }
 material.customProgramCacheKey=()=> 'painted-autumn-trees-v1'
 material.needsUpdate=true
}
