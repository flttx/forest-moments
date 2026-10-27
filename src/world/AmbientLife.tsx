import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useForestStore } from '../game/store'
import { groundHeightAt } from '../game/movement'
import { clearings, meadowWeight } from './worldConfig'

const BUTTERFLIES = 10, DRIFTERS = 36, AREA = 30
const hash = (n: number, k: number) => { const v = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v) }

/** Two small wings folded into a shallow V; the flap scales the wing width about the body line. */
function butterflyGeometry() {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.05, 0.11, 0.035, -0.07, 0.1, 0.03, 0.06, 0, 0, 0.05, -0.11, 0.035, -0.07, -0.1, 0.03, 0.06], 3))
  g.setIndex([0, 1, 2, 0, 3, 1, 0, 5, 4, 0, 4, 6].map(i => i % 7)); g.computeVertexNormals()
  return g
}

const POINT_VERTEX = /* glsl */ `
  attribute float phase;
  uniform float time, size, pulse, steady;
  varying float vGlow;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vGlow = mix(1.0, 0.25 + 0.75 * pow(0.5 + 0.5 * sin(time * pulse + phase * 6.2831), 2.0), pulse > 0.0 ? 1.0 : 0.0);
    gl_PointSize = size * (0.6 + 0.4 * vGlow) * (60.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`
const POINT_FRAGMENT = /* glsl */ `
  uniform vec3 colour; uniform float opacity;
  varying float vGlow;
  void main(){
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, d)); a *= a;
    gl_FragColor = vec4(colour, a * vGlow * opacity);
  }`

function driftMaterial(colour: string, size: number, pulse: number) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, size: { value: size }, pulse: { value: pulse }, steady: { value: 0 }, colour: { value: new THREE.Color(colour) }, opacity: { value: 0 } },
    vertexShader: POINT_VERTEX, fragmentShader: POINT_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
}

/**
 * Day butterflies over the meadows, dusk seed fluff, night fireflies. All are decoration that follows the player,
 * fades with the time of day and stays still or hidden under reduced motion.
 */
export function AmbientLife() {
  const reduced = useRef(false)
  const clock = useRef(0)
  const parts = useMemo(() => {
    const geometry = butterflyGeometry()
    const butterfly = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }), BUTTERFLIES)
    const palette = ['#e8c24a', '#f2ece0', '#9bb4d8', '#e69a6a'].map(c => new THREE.Color(c))
    for (let i = 0; i < BUTTERFLIES; i++) butterfly.setColorAt(i, palette[i % palette.length])
    butterfly.frustumCulled = false; butterfly.raycast = () => {}
    const makePoints = (material: THREE.ShaderMaterial, count: number) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
      g.setAttribute('phase', new THREE.Float32BufferAttribute(Array.from({ length: count }, (_, i) => hash(i, 9)), 1))
      const points = new THREE.Points(g, material); points.frustumCulled = false; points.raycast = () => {}
      return points
    }
    const seeds = driftMaterial('#f1ead2', 1.3, 0), flies = driftMaterial('#d6f27a', 2.8, 2.1)
    return { geometry, butterfly, seeds, flies, seedPoints: makePoints(seeds, DRIFTERS), flyPoints: Object.assign(makePoints(flies, DRIFTERS), { name: 'fireflies' }) }
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => { reduced.current = media.matches }; changed(); media.addEventListener('change', changed)
    return () => {
      media.removeEventListener('change', changed)
      parts.geometry.dispose(); parts.butterfly.dispose(); parts.seeds.dispose(); parts.flies.dispose()
      parts.seedPoints.geometry.dispose(); parts.flyPoints.geometry.dispose()
    }
  }, [parts])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const live = useRef(parts)
  useFrame((_, dt) => {
    const parts = live.current
    const state = useForestStore.getState()
    const light = state.timeOfDay, player = state.position
    if (!reduced.current) clock.current += Math.min(dt, 0.05)
    const t = clock.current
    const fade = (m: THREE.ShaderMaterial, on: boolean, hiddenWhenReduced: boolean) => {
      const target = on && !(hiddenWhenReduced && reduced.current) ? 1 : 0
      const o = m.uniforms.opacity
      o.value += (target - o.value) * Math.min(1, dt * 1.5)
      m.uniforms.time.value = t
    }
    fade(parts.seeds, light === 'dusk', true); fade(parts.flies, light === 'night', false)
    const butterfliesOn = light === 'day' && !reduced.current
    parts.butterfly.visible = butterfliesOn
    if (butterfliesOn) {
      const meadows = [...clearings, { x: player.x, z: player.z, r: 6 }]
      for (let i = 0; i < BUTTERFLIES; i++) {
        // each butterfly circles its own meadow (or the player's surroundings) on a wandering Lissajous path
        const home = meadows[i % meadows.length], a = t * (0.18 + hash(i, 1) * 0.12) + hash(i, 2) * 6.28
        const x = home.x + Math.cos(a) * home.r * 0.8 + Math.sin(a * 2.3 + i) * 0.9, z = home.z + Math.sin(a * 1.3) * home.r * 0.8 + Math.cos(a * 1.7 + i) * 0.9
        const y = groundHeightAt(x, z) + 0.7 + Math.sin(t * 0.9 + i * 2) * 0.35 + 0.3 * meadowWeight(x, z)
        const heading = Math.atan2(-Math.sin(a * 1.3 + 0.4) * 1.3, -Math.sin(a))
        const flap = Math.abs(Math.sin(t * 17 + i * 3.1))
        dummy.position.set(x, y, z); dummy.rotation.set(0.25 * Math.sin(t * 2 + i), heading, 0); dummy.scale.set(0.35 + flap * 0.65, 1, 1)
        dummy.updateMatrix(); parts.butterfly.setMatrixAt(i, dummy.matrix)
      }
      parts.butterfly.instanceMatrix.needsUpdate = true
    }
    const place = (points: THREE.Points, active: boolean, rise: number, wobble: number) => {
      if (!active) return
      const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < DRIFTERS; i++) {
        // fixed cells wrapped around the player so the cloud always surrounds the view without per-particle state
        const u = hash(i, 3), v = hash(i, 4), w = hash(i, 5)
        const wrap = (n: number, centre: number) => centre + ((((n % AREA) + AREA) % AREA) - AREA / 2)
        const x = wrap(u * AREA + t * wobble * (hash(i, 6) - 0.5) + Math.sin(t * 0.4 + i) * 0.8, player.x)
        const z = wrap(v * AREA + t * wobble * (hash(i, 7) - 0.5) + Math.cos(t * 0.35 + i) * 0.8, player.z)
        const y = groundHeightAt(x, z) + 0.5 + ((w * 2.4 + t * rise) % 2.6)
        attr.setXYZ(i, x, y, z)
      }
      attr.needsUpdate = true
    }
    place(parts.seedPoints, parts.seeds.uniforms.opacity.value > 0.01, 0.12, 0.5)
    place(parts.flyPoints, parts.flies.uniforms.opacity.value > 0.01, 0.03, 0.25)
  })
  return <group name="ambient-life">
    <primitive object={parts.butterfly} />
    <primitive object={parts.seedPoints} />
    <primitive object={parts.flyPoints} />
  </group>
}
