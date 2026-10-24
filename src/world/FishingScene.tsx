import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useForestStore } from '../game/store'
import { pond } from '../game/rowing'

export function FishingScene() {
  const rodSource = useGLTF('/assets/models/fishing-rod.glb')
  const fishSource = useGLTF('/assets/models/fish-koi.glb')
  const parts = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'fishing-tools'
    const rod = clone(rodSource.scene), fish = clone(fishSource.scene)
    const tip = rod.getObjectByName('Locator_RodTip')
    if (!tip) throw new Error('Fishing rod tip locator is missing')
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3)), new THREE.LineBasicMaterial({ color: '#f4eedb' }))
    line.frustumCulled = false
    const float = new THREE.Group()
    const red = new THREE.MeshStandardMaterial({ color: '#c44332', roughness: .75 })
    const white = new THREE.MeshStandardMaterial({ color: '#f4ecd8', roughness: .8 })
    const bead = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 8), white)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .13, 8), red)
    cap.position.y = .075
    float.add(bead, cap)
    const ring = new THREE.Mesh(new THREE.RingGeometry(.27, .29, 40), new THREE.MeshBasicMaterial({ color: '#f4edcf', transparent: true, opacity: .6, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2
    ring.renderOrder = 1
    group.add(rod, fish, line, float, ring)
    return { group, rod, fish, tip, line, float, ring, basis: new THREE.Matrix4(), grip: new THREE.Vector3(), x: new THREE.Vector3(), forward: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), tipPosition: new THREE.Vector3(), landing: new THREE.Vector3(4.2, pond.waterY + .04, -5), end: new THREE.Vector3() }
  }, [rodSource.scene, fishSource.scene])
  const runtime = useRef(parts)
  useEffect(() => {
    runtime.current = parts
    useForestStore.getState().setFishingReady(true)
    return () => {
      useForestStore.getState().setFishingReady(false)
      parts.line.geometry.dispose(); (parts.line.material as THREE.Material).dispose()
      parts.float.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); o.material.dispose() } })
      parts.ring.geometry.dispose(); parts.ring.material.dispose()
    }
  }, [parts])
  useFrame(({ scene }) => {
    const p = runtime.current, state = useForestStore.getState(), f = state.fishing
    p.group.visible = state.mode === 'fishing' && !!f
    if (!f || !p.group.visible) return
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
    p.forward.z *= .15
    p.forward.normalize()
    p.right.crossVectors(p.forward, THREE.Object3D.DEFAULT_UP).normalize()
    p.up.crossVectors(p.right, p.forward).normalize()
    p.basis.makeBasis(p.right, p.up, p.forward.clone().negate())
    p.rod.quaternion.setFromRotationMatrix(p.basis)
    p.rod.position.copy(p.grip)
    p.rod.updateMatrixWorld(true)
    p.tip.getWorldPosition(p.tipPosition)
    p.end.copy(p.landing)
    if (f.phase === 'casting') {
      const flight = THREE.MathUtils.clamp((f.elapsed - 1.85) / 1.35, 0, 1)
      p.end.lerpVectors(p.tipPosition, p.landing, flight)
      p.end.y += Math.sin(flight * Math.PI) * 1.1
    } else if (f.phase === 'reeling') {
      p.end.x -= f.progress * 1.75
      p.end.z += Math.sin(f.elapsed * 3) * .12 * (1 - f.progress)
    } else if (f.phase === 'landing' || f.phase === 'caught') {
      const u = f.phase === 'caught' ? 1 : Math.min(f.elapsed / (7 / 6), 1)
      p.end.set(2.45, pond.waterY + .04, -5).lerp(p.tipPosition.clone().add(new THREE.Vector3(0, -.45, 0)), u)
    } else p.end.y += f.phase === 'bite' ? -.025 + Math.sin(f.elapsed * 20) * .018 : Math.sin(f.elapsed * 3) * .015
    p.float.position.copy(p.end)
    p.float.visible = !['landing', 'caught'].includes(f.phase)
    p.ring.visible = ['waiting', 'bite', 'reeling'].includes(f.phase)
    p.ring.position.set(p.end.x, pond.waterY + .008, p.end.z)
    p.ring.scale.setScalar(f.phase === 'bite' ? 1 + .25 * Math.sin(f.elapsed * 12) : .7)
    p.fish.visible = ['landing', 'caught'].includes(f.phase)
    // Evaluated skeleton length is 1 m; the raw decoded mesh spans 2 m.
    p.fish.scale.setScalar(f.sizeCm / 100)
    p.fish.position.copy(p.end).y -= f.sizeCm / 200
    p.fish.rotation.set(-Math.PI / 2, 0, .08 * Math.sin(f.elapsed * 8))
    const attribute = p.line.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < 24; i++) {
      const u = i / 23
      attribute.setXYZ(i, THREE.MathUtils.lerp(p.tipPosition.x, p.end.x, u), THREE.MathUtils.lerp(p.tipPosition.y, p.end.y, u) - Math.sin(u * Math.PI) * (f.phase === 'reeling' ? .035 : .12), THREE.MathUtils.lerp(p.tipPosition.z, p.end.z, u))
    }
    attribute.needsUpdate = true
    if (import.meta.env.DEV) p.group.userData.qa = { grip: p.grip.toArray(), rod: p.rod.position.toArray(), tip: p.tipPosition.toArray(), float: p.end.toArray(), fishVisible: p.fish.visible }
  }, -.5)
  return <primitive object={parts.group} dispose={null} />
}
