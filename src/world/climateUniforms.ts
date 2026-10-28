import * as THREE from 'three'
import {jellyfishSpot} from '../game/secrets'

/**
 * Shared shader inputs for weather and season (plan X4). One object per input, referenced by every material that
 * reads it (terrain, grass, crowns), so the Climate component eases them all at once each frame.
 */
export const climateUniforms={
 climateBroadleaf:{value:new THREE.Vector3(1,1,1)},
 climatePine:{value:new THREE.Vector3(1,1,1)},
 climateGrass:{value:new THREE.Vector3(1,1,1)},
 climateWet:{value:0},
 /** Rain on water surfaces, 0..1 (follows climateNow.rain). */
 climateRain:{value:0},
 /** Seconds of falling rain (held under reduced motion), for rings on puddles and the creek. */
 climateTime:{value:0},
 /** Flower heads in the grass, as a multiple of summer's. */
 climateBloom:{value:1},
 /** Fallen leaves lying on the ground, 0..1. */
 climateLitter:{value:0},
 /** How far broadleaf crowns have turned to autumn colours, 0..1. */
 climateTurn:{value:0},
}
export const climateGLSL='uniform vec3 climateGrass;uniform float climateWet;\n'
/** Eased weather numbers for the sky, light, fog, rain and leaves (not shader uniforms); written by Climate. */
export const climateNow={overcast:0,light:1,fog:1,rain:0,leaves:0,fireflies:1,butterflies:.8}
/**
 * Raindrop rings on open water: in each 0.8 m cell one drop lands at a cell-fixed spot and phase, and its ring spreads
 * to ~0.4 m and fades within about 0.9 s. Returns (ring brightness, outward slope x, z) summed over neighbouring cells.
 */
export const rainRingsGLSL=/* glsl */ `
uniform float climateRain;
vec3 rainRings(vec2 p,float t){
  vec3 acc=vec3(0.0);
  vec2 base=floor(p/.8);
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
    vec2 c=base+vec2(float(i),float(j));
    vec2 h=fract(sin(vec2(dot(c,vec2(127.1,311.7)),dot(c,vec2(269.5,183.3))))*43758.5453);
    vec2 centre=(c+.15+.7*h)*.8;
    float age=fract(t*1.1+h.x*7.0+h.y*3.0);
    vec2 d=p-centre;float dist=length(d);
    float ring=(1.0-smoothstep(0.0,.035,abs(dist-age*.42)))*(1.0-age)*(1.0-age);
    acc.x+=ring;acc.yz+=ring*d/max(dist,1e-3);
  }
  return acc;
}
`
/** The hidden jellyfish's glow seen through the sea from above: xyz its position, w how bright (the sea shader reads it). */
export const jellyGlow={value:new THREE.Vector4(jellyfishSpot.x,jellyfishSpot.y,jellyfishSpot.z,0)}
const blank=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blank.needsUpdate=true
/** The puddle mirror (PuddleReflection writes it, the terrain reads it): texture, projection, on, and its height. */
export const puddleReflection={puddleMap:{value:blank as THREE.Texture},puddleMatrix:{value:new THREE.Matrix4()},puddleOn:{value:0},puddleHeight:{value:0},blank}
