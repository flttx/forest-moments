import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { tideCreatures } from '../game/tidePoolLife'
import { tideHeight, tidePools, poolRadius } from './tideIsland'

/** A five-armed starfish, extruded with a soft bevel and lying on the pool bed. */
function starfish() {
  const shape = new THREE.Shape()
  for (let i = 0; i <= 80; i++) {
    const a = i / 80 * Math.PI * 2, r = .035 + .085 * Math.pow(Math.abs(Math.cos(a * 2.5)), 1.7)
    const [x, y] = [Math.cos(a) * r, Math.sin(a) * r]
    if (i) shape.lineTo(x, y); else shape.moveTo(x, y)
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .01, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 2 }).rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#cf6a2e', roughness: .75 }))
  mesh.receiveShadow = true
  return new THREE.Group().add(mesh)
}

/** A sea anemone: a squat column and a crown of tentacles, which sway on their own phases. */
function anemone() {
  const group = new THREE.Group()
  const column = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .06, 12), new THREE.MeshStandardMaterial({ color: '#9a4a52', roughness: .8 }))
  column.position.y = .03; group.add(column)
  const tentacle = new THREE.ConeGeometry(.009, .085, 5).translate(0, .042, 0)
  const tentacles = new THREE.InstancedMesh(tentacle, new THREE.MeshStandardMaterial({ color: '#e08a8e', roughness: .6 }), 26)
  tentacles.name = 'anemone-tentacles'; group.add(tentacles)
  return group
}

/** A hermit crab: the turban shell from the shell set, small legs and two claws, ambling round the pool bed. */
function hermitCrab(shell: THREE.Object3D | undefined) {
  const group = new THREE.Group(), legs = new THREE.MeshStandardMaterial({ color: '#b5502e', roughness: .7 })
  if (shell) { const s = shell.clone(true); s.position.set(0, .02, -.01); s.rotation.x = -.5; s.scale.setScalar(3.2); group.add(s) }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.005, .004, .06, 5), legs)
      leg.position.set(side * .03, .015, .02 - i * .02); leg.rotation.z = side * 1.1; leg.name = 'crab-leg'; group.add(leg)
    }
    const claw = new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 6).scale(1.3, .8, 1), legs)
    claw.position.set(side * .02, .02, .055); group.add(claw)
  }
  return group
}

export function TidePoolLife() {
  const gltf = useGLTF('/assets/expansion/shell-set.glb')
  const life = useMemo(() => {
    const root = new THREE.Group(); root.name = 'tide-pool-life'
    const made = { starfish: starfish(), anemone: anemone(), hermitCrab: hermitCrab(gltf.scene.getObjectByName('Shell_Turban')) }
    for (const c of tideCreatures) {
      const body = made[c.id]; body.name = `tide-${c.id}`
      body.position.set(c.x, tideHeight(c.x, c.z) + .005, c.z); body.rotation.y = c.pool * 1.7
      root.add(body)
    }
    return { root, made }
  }, [gltf.scene])
  // Built here, so freed here; the turban shell's geometry belongs to the cached GLTF.
  useEffect(() => () => life.root.traverse(o => { if (o instanceof THREE.Mesh && o.name !== 'Shell_Turban') { o.geometry.dispose(); (o.material as THREE.Material).dispose() } }), [life])
  const reduced = useRef(false)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), changed = () => { reduced.current = media.matches }
    changed(); media.addEventListener('change', changed); return () => media.removeEventListener('change', changed)
  }, [])
  const state = useRef(life)
  useFrame(({ clock }) => {
    const { made } = state.current, t = reduced.current ? 0 : clock.elapsedTime, dummy = new THREE.Object3D()
    // tentacles: a ring, each leaning out and swaying on its own phase
    const tentacles = made.anemone.getObjectByName('anemone-tentacles') as THREE.InstancedMesh
    for (let i = 0; i < tentacles.count; i++) {
      const a = i / tentacles.count * Math.PI * 2, sway = Math.sin(t * 1.3 + i * .7) * .25
      dummy.position.set(Math.cos(a) * .035, .055, Math.sin(a) * .035)
      dummy.rotation.set(Math.sin(a) * (.7 + sway), 0, -Math.cos(a) * (.7 + sway)); dummy.updateMatrix(); tentacles.setMatrixAt(i, dummy.matrix)
    }
    tentacles.instanceMatrix.needsUpdate = true
    // the crab walks a small loop on the pool bed, pausing now and then; legs tick while it moves
    const crab = tideCreatures.find(c => c.id === 'hermitCrab')!, pool = tidePools[crab.pool]
    const walking = Math.sin(t * .35) > -.2, phase = t * .12 + Math.sin(t * .35) * .4
    const x = crab.x + Math.cos(phase) * pool.rx * .25, z = crab.z + Math.sin(phase) * pool.rz * .25
    if (poolRadius(x, z, pool) < .85) { made.hermitCrab.position.set(x, tideHeight(x, z) + .005, z); made.hermitCrab.rotation.y = -phase }
    made.hermitCrab.children.forEach((leg, i) => { if (leg.name === 'crab-leg') leg.rotation.x = walking ? Math.sin(t * 9 + i) * .35 : 0 })
    // the starfish creeps round very slowly
    made.starfish.rotation.y = tideCreatures[0].pool * 1.7 + t * .02
  })
  return <primitive object={life.root} dispose={null} />
}
