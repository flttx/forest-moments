import { dressFish } from './fishLook'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useForestStore } from '../game/store'
import { pond } from '../game/rowing'
import { fishingSites } from '../game/fishing'
import { latestCatchChoice } from '../game/expansion'

// A soft travelling crest with a darker trough just inside it, fading as it spreads: reads as a
// disturbance of the water rather than a drawn outline.
const rippleShader = {
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `varying vec2 vUv;uniform float progress;uniform float strength;
void main(){
 float d=length(vUv-.5)*2.0,r=1.0-(1.0-progress)*(1.0-progress),w=.05+.09*progress;
 float crest=1.0-smoothstep(0.0,w,abs(d-r)),trough=1.0-smoothstep(0.0,w*1.4,abs(d-r+w*1.6));
 float echo=(1.0-smoothstep(0.0,w,abs(d-r*.62)))*.45;
 float fade=strength*(1.0-progress)*(1.0-progress)*step(d,1.0);
 gl_FragColor=vec4(mix(vec3(.05,.13,.12),vec3(.82,.92,.9),clamp(crest+echo,0.0,1.0)),(max(crest+echo,trough*.7))*fade*.42);
}`,
}
// A soft dark fish body just under the surface, with a narrower tail.
const shadowShader = {
  vertexShader: rippleShader.vertexShader,
  fragmentShader: `varying vec2 vUv;uniform float opacity;
void main(){vec2 p=(vUv-.5)*2.0;float body=1.0-smoothstep(.55,1.0,length(vec2(p.x,p.y*2.6)));
 float tail=(1.0-smoothstep(.0,.22,abs(p.y)-.12*(p.x+1.0)))*step(p.x,-.6)*step(-1.0,p.x);
 gl_FragColor=vec4(.03,.06,.05,max(body,tail*.8)*opacity);}`,
}
interface Ripple { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; start: number; life: number }
interface Drop { position: THREE.Vector3; velocity: THREE.Vector3; alive: boolean }

export function FishingScene() {
  const rodSource = useGLTF('/assets/models/fishing-rod.glb')
  const fishSource = useGLTF('/assets/models/fish-koi.glb')
  const parts = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'fishing-tools'
    const rod = clone(rodSource.scene), fish = clone(fishSource.scene)
    const tip = rod.getObjectByName('Locator_RodTip')
    if (!tip) throw new Error('Fishing rod tip locator is missing')
    // Monofilament is barely visible: thin, pale and partly see-through.
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3)), new THREE.LineBasicMaterial({ color: '#e6e8df', transparent: true, opacity: .45 }))
    line.frustumCulled = false
    // A slim float that rides low: the pale body sits mostly under water, the painted antenna stands clear.
    const float = new THREE.Group()
    const red = new THREE.MeshStandardMaterial({ color: '#d2442c', roughness: .6 })
    const white = new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: .7 })
    const body = new THREE.Mesh(new THREE.SphereGeometry(.026, 14, 10), white)
    body.scale.y = 1.7
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.006, .009, .1, 8), red)
    antenna.position.y = .085
    float.add(body, antenna)
    const ripples: Ripple[] = Array.from({ length: 10 }, () => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ ...rippleShader, uniforms: { progress: { value: 1 }, strength: { value: 0 } }, transparent: true, depthWrite: false }))
      mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 2; mesh.visible = false
      return { mesh, start: -Infinity, life: 1 }
    })
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ ...shadowShader, uniforms: { opacity: { value: 0 } }, transparent: true, depthWrite: false }))
    shadow.renderOrder = 1
    const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.011, 6, 4), new THREE.MeshBasicMaterial({ color: '#e4f0ee', transparent: true, opacity: .75 }), 16)
    drops.frustumCulled = false
    const spray: Drop[] = Array.from({ length: 16 }, () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), alive: false }))
    group.add(rod, fish, line, float, shadow, drops, ...ripples.map(r => r.mesh))
    return { group, rod, fish, tip, line, float, ripples, shadow, drops, spray, phase: '', choice: '' as string, clock: 0, nextRipple: 0, beat: 0, matrix: new THREE.Matrix4(), basis: new THREE.Matrix4(), grip: new THREE.Vector3(), x: new THREE.Vector3(), forward: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), tipPosition: new THREE.Vector3(), landing: new THREE.Vector3(4.2, pond.waterY, -5), end: new THREE.Vector3() }
  }, [rodSource.scene, fishSource.scene])
  const runtime = useRef(parts)
  const reduced = useRef(false)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => { reduced.current = media.matches }; changed(); media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    runtime.current = parts
    useForestStore.getState().setFishingReady(true)
    return () => {
      useForestStore.getState().setFishingReady(false)
      parts.line.geometry.dispose(); (parts.line.material as THREE.Material).dispose()
      parts.float.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); o.material.dispose() } })
      // Ripples, fish shadow and spray; the rod and fish clones share the cached GLTF resources.
      for (const o of parts.group.children) if (o instanceof THREE.Mesh && o !== parts.rod && o !== parts.fish) { o.geometry.dispose(); o.material.dispose() }
    }
  }, [parts])
  useFrame(({ scene }, delta) => {
    const p = runtime.current, state = useForestStore.getState(), f = state.fishing
    p.group.visible = state.mode === 'fishing' && !!f
    if (!f || !p.group.visible) { p.phase = ''; return }
    const site = fishingSites[f.site], ahead = new THREE.Vector3(-Math.sin(site.facing), 0, -Math.cos(site.facing))
    p.landing.set(site.float.x, site.waterY, site.float.z)
    const dt = Math.min(delta, .05), still = reduced.current
    p.clock += dt
    const ripple = (x: number, z: number, strength: number, size: number) => {
      const r = p.ripples.reduce((a, b) => a.mesh.material.uniforms.progress.value >= b.mesh.material.uniforms.progress.value ? a : b)
      r.start = p.clock; r.life = .9 + size * 1.6; r.mesh.visible = true
      r.mesh.position.set(x, site.waterY + .006, z); r.mesh.scale.setScalar(size * 2)
      r.mesh.material.uniforms.strength.value = strength
    }
    const splash = (x: number, z: number, count: number, speed: number) => {
      if (still) return
      for (const d of p.spray.filter(d => !d.alive).slice(0, count)) {
        const a = Math.random() * Math.PI * 2, s = speed * (.4 + Math.random() * .6)
        d.alive = true; d.position.set(x, site.waterY + .02, z); d.velocity.set(Math.cos(a) * s * .45, s * (1.2 + Math.random() * .8), Math.sin(a) * s * .45)
      }
    }
    const actor = scene.getObjectByName('asset-raccoon')
    const hand = actor?.getObjectByName('mixamorigLeftHand')
    const knuckle = actor?.getObjectByName('mixamorigLeftHandIndex1')
    if (!hand || !knuckle) return
    hand.updateWorldMatrix(true, true)
    hand.getWorldPosition(p.grip).lerp(knuckle.getWorldPosition(p.x), .5)
    p.basis.extractRotation(hand.matrixWorld)
    p.x.setFromMatrixColumn(p.basis, 0)
    p.forward.setFromMatrixColumn(p.basis, 2).addScaledVector(p.x, .6).normalize()
    // Prop-only orientation inherited from the reference cast; actor bones stay untouched.
    // Keep the rod pointing out over the water: damp its sideways lean relative to where the angler faces.
    const side = new THREE.Vector3(-ahead.z, 0, ahead.x), lean = p.forward.dot(side)
    p.forward.addScaledVector(side, -lean * .85)
    p.forward.normalize()
    p.right.crossVectors(p.forward, THREE.Object3D.DEFAULT_UP).normalize()
    p.up.crossVectors(p.right, p.forward).normalize()
    p.basis.makeBasis(p.right, p.up, p.forward.clone().negate())
    p.rod.quaternion.setFromRotationMatrix(p.basis)
    p.rod.position.copy(p.grip)
    p.rod.updateMatrixWorld(true)
    p.tip.getWorldPosition(p.tipPosition)
    const entered = p.phase !== f.phase, previous = p.phase
    p.phase = f.phase
    // The float rides low: body centre 2 cm under the surface, only the cap and antenna showing.
    const rest = site.waterY - .02
    p.end.copy(p.landing)
    let tilt = Math.sin(p.clock * 1.7) * .06, sink = 0
    if (f.phase === 'casting') {
      const flight = THREE.MathUtils.clamp((f.elapsed - 1.85) / 1.35, 0, 1)
      p.end.lerpVectors(p.tipPosition, p.landing, flight)
      p.end.y += Math.sin(flight * Math.PI) * 1.1
      // Touch-down: a plop, a short crown of droplets and a couple of spreading rings.
      if (flight >= 1 && p.beat === 0) { p.beat = 1; ripple(p.end.x, p.end.z, 1, .75); splash(p.end.x, p.end.z, 8, 1.1); p.nextRipple = .35 }
      if (flight < 1) p.beat = 0
      else p.end.y = rest
    } else if (f.phase === 'waiting' || f.phase === 'escaped') {
      p.end.y = rest + Math.sin(p.clock * 2.2) * .005
      if (entered && f.phase === 'escaped' && previous !== 'casting') { ripple(p.end.x, p.end.z, .8, .6); splash(p.end.x, p.end.z, 4, .8) }
    } else if (f.phase === 'bite') {
      // Nibbles: sharp pulls that drag the antenna under, then let it bob back up.
      const pull = Math.max(0, Math.sin(f.elapsed * 8.5)) ** 6, beat = Math.floor(f.elapsed * 8.5 / (Math.PI * 2) + .25)
      sink = pull * .085; tilt += pull * .35
      if (entered || beat !== p.beat) { p.beat = beat; ripple(p.end.x, p.end.z, .55 + pull * .3, .45) }
      p.end.y = rest - sink
    } else if (f.phase === 'reeling') {
      // The hooked fish drags the float toward the bank: tilted, half dunked, trailing small rings.
      p.end.x -= f.progress * 1.75
      p.end.z += Math.sin(f.elapsed * 3) * .12 * (1 - f.progress)
      sink = .03 + .025 * Math.max(0, Math.sin(f.elapsed * 7)) * (1 - f.progress)
      p.end.y = rest - sink; tilt = -.5 + Math.sin(f.elapsed * 7) * .15
      if (entered) p.beat = 0
      // Sparse rings left behind the float as it is towed toward the bank, not a stacked target.
      if (Math.floor(f.elapsed * 2.5) !== p.beat) { p.beat = Math.floor(f.elapsed * 2.5); ripple(p.end.x + .16, p.end.z, .25 + f.tension * .3, .22 + f.tension * .15) }
      if (f.tension > .7 && Math.random() < dt * 6) splash(p.end.x + .1, p.end.z + (Math.random() - .5) * .2, 2, .7)
    } else if (f.phase === 'landing' || f.phase === 'caught') {
      const u = f.phase === 'caught' ? 1 : Math.min(f.elapsed / (7 / 6), 1)
      p.end.set(site.cast.x, site.waterY + .04, site.cast.z).lerp(p.tipPosition.clone().add(new THREE.Vector3(0, -.45, 0)), u)
      // The fish breaks the surface: a burst of spray and rings where it left the water.
      if (entered && f.phase === 'landing') { ripple(site.cast.x, site.cast.z, 1, .8); ripple(site.cast.x + .05, site.cast.z + .05, .7, .5); splash(site.cast.x, site.cast.z, 12, 1.4) }
    }
    if (f.phase === 'waiting' || f.phase === 'escaped') {
      p.nextRipple -= dt
      if (p.nextRipple <= 0) { p.nextRipple = 2.2 + Math.random() * 1.6; ripple(p.end.x, p.end.z, .3, .35) }
    }
    p.float.position.copy(p.end)
    p.float.rotation.set(0, 0, tilt)
    p.float.visible = !['landing', 'caught'].includes(f.phase)
    p.ripples.forEach(r => {
      const progress = Math.min(1, (p.clock - r.start) / r.life)
      r.mesh.visible = progress < 1
      r.mesh.material.uniforms.progress.value = progress
    })
    // A dark fish shape under the float while it bites and fights, never drawn above the water.
    const fighting = f.phase === 'reeling', near = f.phase === 'bite' || fighting
    const shadowOpacity = p.shadow.material.uniforms.opacity
    shadowOpacity.value = THREE.MathUtils.damp(shadowOpacity.value, near ? (fighting ? .34 : .2) : 0, 4, dt)
    p.shadow.visible = shadowOpacity.value > .01
    const swim = fighting ? f.elapsed * 7 : p.clock * 2, heading = fighting ? Math.PI + Math.sin(swim) * .35 : p.clock * .9
    p.shadow.position.set(p.end.x + Math.cos(heading) * (fighting ? .18 : .32), site.waterY + .004, p.end.z - Math.sin(heading) * (fighting ? .18 : .32))
    p.shadow.rotation.set(-Math.PI / 2, 0, heading + (fighting ? 0 : Math.PI / 2) + Math.sin(swim * 1.6) * .12)
    p.shadow.scale.set(f.sizeCm / 100 * 1.1, f.sizeCm / 100 * .5, 1)
    let shown = 0
    p.spray.forEach(d => {
      if (d.alive) {
        d.velocity.y -= 9.8 * dt; d.position.addScaledVector(d.velocity, dt)
        if (d.position.y < site.waterY) d.alive = false
      }
      if (d.alive) p.drops.setMatrixAt(shown++, p.matrix.makeTranslation(d.position.x, d.position.y, d.position.z))
    })
    p.drops.count = shown; p.drops.instanceMatrix.needsUpdate = true
    // Once kept or let go, the koi leaves the line; letting it go drops it back with a splash.
    const choice = f.phase === 'caught' ? latestCatchChoice(state) ?? '' : ''
    if (choice === 'released' && p.choice !== 'released') { ripple(site.cast.x, site.cast.z, .9, .7); splash(site.cast.x, site.cast.z, 10, 1.2) }
    p.choice = choice
    p.fish.visible = f.phase === 'landing' || (f.phase === 'caught' && !choice)
    if (p.fish.userData.species !== f.species) dressFish(p.fish, f.species)
    // Evaluated skeleton length is 1 m; the raw decoded mesh spans 2 m.
    p.fish.scale.setScalar(f.sizeCm / 100)
    p.fish.position.copy(p.end).y -= f.sizeCm / 200
    p.fish.rotation.set(-Math.PI / 2, 0, .08 * Math.sin(f.elapsed * 8))
    // The line ties onto the antenna; slack hangs in a catenary-like sag, taut while the fish pulls.
    const knot = p.float.visible ? p.x.copy(p.end).add(new THREE.Vector3(-Math.sin(tilt) * .13, Math.cos(tilt) * .13, 0)) : p.x.copy(p.end)
    const sag = f.phase === 'reeling' ? .02 : f.phase === 'bite' ? .05 : f.phase === 'casting' ? .04 : .16
    const attribute = p.line.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < 24; i++) {
      const u = i / 23
      attribute.setXYZ(i, THREE.MathUtils.lerp(p.tipPosition.x, knot.x, u), THREE.MathUtils.lerp(p.tipPosition.y, knot.y, u) - Math.sin(u * Math.PI) * sag * (.6 + .4 * u), THREE.MathUtils.lerp(p.tipPosition.z, knot.z, u))
    }
    attribute.needsUpdate = true
    if (import.meta.env.DEV) p.group.userData.qa = { grip: p.grip.toArray(), rod: p.rod.position.toArray(), tip: p.tipPosition.toArray(), float: p.end.toArray(), fishVisible: p.fish.visible }
  }, -.5)
  return <primitive object={parts.group} dispose={null} />
}
