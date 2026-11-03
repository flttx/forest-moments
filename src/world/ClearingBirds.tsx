import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useForestStore } from '../game/store'
import { groundHeightAt } from '../game/movement'
import { clearing, fleeRadius, settleRadius, hopSeconds, perchFor } from './birdPerches'

/** A small robin: brown back, orange breast, dark beak and tail; wings are separate so they can flap. */
function robin() {
  const group = new THREE.Group(), back = new THREE.MeshStandardMaterial({ color: '#6b5240', roughness: .85 }), breast = new THREE.MeshStandardMaterial({ color: '#c96a33', roughness: .8 }), dark = new THREE.MeshStandardMaterial({ color: '#2d2621', roughness: .7 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8).scale(1, .85, 1.35), back); body.position.y = .06; group.add(body)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.042, 10, 8).scale(.95, .85, .8), breast); chest.position.set(0, .055, .035); group.add(chest)
  const head = new THREE.Mesh(new THREE.SphereGeometry(.032, 10, 8), back); head.position.set(0, .105, .055); head.name = 'head'; group.add(head)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.008, .025, 5).rotateX(Math.PI / 2), dark); beak.position.set(0, .1, .095); head.attach(beak)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.035, .008, .06), dark); tail.position.set(0, .07, -.075); tail.rotation.x = -.35; group.add(tail)
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6).scale(.25, .7, 1.2), back)
    wing.position.set(side * .045, .07, -.005); wing.name = side < 0 ? 'wingL' : 'wingR'; group.add(wing)
  }
  group.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true })
  // a touch larger than life (about 20 cm) so they still read from the follow camera beside a raccoon
  group.scale.setScalar(1.5)
  return group
}

interface Bird { body: THREE.Group; home: THREE.Vector2; perch: THREE.Vector3; state: 'ground' | 'away' | 'flying'; t: number; from: THREE.Vector3; to: THREE.Vector3; hopAt: number; seed: number; hop: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null }

/** Three robins on the clearing floor: they hop and peck, scatter up into the crowns when the raccoon comes close, and drop back once it has gone. */
export function ClearingBirds() {
  const flock = useMemo(() => {
    const root = new THREE.Group(); root.name = 'clearing-birds'
    const birds: Bird[] = [0, 1, 2].map(i => {
      const a = i * 2.2 + .4, home = new THREE.Vector2(clearing.x + Math.cos(a) * 1.4, clearing.z + Math.sin(a) * 1.4)
      // each has its own perch in a real crown round the clearing
      const perch = perchFor(a + .3)
      const body = robin(); body.position.set(home.x, groundHeightAt(home.x, home.y), home.y); body.rotation.y = a; root.add(body)
      return { body, home, perch, state: 'ground', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), hopAt: i * .7, seed: i * 1.37, hop: null }
    })
    return { root, birds }
  }, [])
  useEffect(() => () => flock.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } }), [flock])
  const reduced = useRef(false)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), changed = () => { reduced.current = media.matches }
    changed(); media.addEventListener('change', changed); return () => media.removeEventListener('change', changed)
  }, [])
  const state = useRef(flock)
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, .05), now = clock.elapsedTime, player = useForestStore.getState().position
    for (const b of state.current.birds) {
      const d = Math.hypot(player.x - b.body.position.x, player.z - b.body.position.z), wingL = b.body.getObjectByName('wingL')!, wingR = b.body.getObjectByName('wingR')!
      const flyTo = (to: THREE.Vector3) => { b.state = 'flying'; b.t = 0; b.hop = null; b.from.copy(b.body.position); b.to.copy(to) }
      if (b.state === 'ground' && d < fleeRadius) flyTo(b.perch)
      else if (b.state === 'away' && Math.hypot(player.x - b.home.x, player.z - b.home.y) > settleRadius && (b.t += dt) > 5) flyTo(new THREE.Vector3(b.home.x, groundHeightAt(b.home.x, b.home.y), b.home.y))
      if (b.state === 'flying') {
        b.t = Math.min(1, b.t + dt / 1.3)
        const p = b.from.clone().lerp(b.to, b.t); p.y += Math.sin(b.t * Math.PI) * 1.2
        b.body.lookAt(b.to.x, b.body.position.y, b.to.z); b.body.position.copy(p)
        const flap = reduced.current ? .6 : Math.sin(now * 38) * .9; wingL.rotation.z = flap; wingR.rotation.z = -flap
        if (b.t >= 1) { b.state = b.to.y > groundHeightAt(b.to.x, b.to.z) + 1 ? 'away' : 'ground'; b.t = 0; wingL.rotation.z = wingR.rotation.z = 0 }
        continue
      }
      if (b.state === 'ground' && !reduced.current) {
        // short hops about home (a quick low arc, never a jump cut), and a peck now and then between them
        if (!b.hop && now > b.hopAt) {
          const a = Math.sin(now * 3.1 + b.seed) * Math.PI, r = .25 + .2 * Math.abs(Math.sin(now + b.seed))
          const x = b.home.x + Math.cos(a) * r, z = b.home.y + Math.sin(a) * r
          b.hop = { from: b.body.position.clone(), to: new THREE.Vector3(x, groundHeightAt(x, z), z), t: 0 }
          b.body.lookAt(x, b.body.position.y, z)
        }
        const head = b.body.getObjectByName('head')!
        if (b.hop) {
          b.hop.t = Math.min(1, b.hop.t + dt / hopSeconds)
          b.body.position.lerpVectors(b.hop.from, b.hop.to, b.hop.t); b.body.position.y += Math.sin(b.hop.t * Math.PI) * .07
          head.rotation.x = 0
          if (b.hop.t >= 1) { b.hop = null; b.hopAt = now + 1.2 + Math.abs(Math.sin(now * 7 + b.seed)) * 1.6 }
        } else {
          const since = b.hopAt - now
          b.body.position.y = groundHeightAt(b.body.position.x, b.body.position.z)
          head.rotation.x = since < .6 ? Math.sin(since * 20) * .5 + .3 : 0
        }
      }
    }
  })
  return <primitive object={flock.root} dispose={null} />
}
