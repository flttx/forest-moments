import { MathUtils } from 'three'
import { pond } from '../game/rowing'

export const seaLevel = -.85

/** Keep the existing walkable plateau intact; shape only the inaccessible coast. */
export function coastRadius(angle: number) {
  return 20.8 + .85 * Math.sin(angle * 3 + .4) + .55 * Math.sin(angle * 5 - .8) + .25 * Math.cos(angle * 9)
}

export function terrainHeight(x: number, z: number) {
  const radius = Math.hypot(x, z)
  const coast = coastRadius(Math.atan2(z, x))
  const shore = MathUtils.smoothstep(radius, 17, coast + 1.8)
  const basin = 1 - MathUtils.smoothstep(Math.hypot(x - pond.x, z - pond.z), pond.radius - .65, pond.radius)
  return -2.3 * shore - .7 * basin
}

export function pathDistance(x: number, z: number) {
  const main = Math.abs(x + 1.7 - Math.sin(z * .23) * 1.15)
  const workshop = x < -1.5 && x > -8.8 ? Math.abs(z - 5.8 - Math.sin(x * .7) * .22) : 100
  const east = x > -1.7 && x < 10.8 ? Math.abs(z - 1.4 + Math.sin(x * .4) * .55) : 100
  const dock = x > 10.2 && z < 1.7 && z > -9.7 ? Math.abs(x - 11.4) : 100
  return Math.min(main, workshop, east, dock)
}

export const noiseGLSL = /* glsl */ `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise21(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);
}
float coastAt(vec2 p) {
  float a=atan(p.y,p.x);
  return 20.8+.85*sin(a*3.0+.4)+.55*sin(a*5.0-.8)+.25*cos(a*9.0);
}
`
