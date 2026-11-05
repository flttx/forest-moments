import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { reefStacks, buoys } from './archipelago'
import { seaLevel } from './worldConfig'
import { useForestStore } from '../game/store'
import { daylightAt, lanternPower } from '../game/dayCycle'

/** Reef stacks from the Blender coastal kit and lit channel buoys between the islands (archipelago.ts holds the layout). */
export function ArchipelagoSea() {
  const gltf = useGLTF('./assets/expansion/coastal-kit.glb')
  const reefs = useMemo(() => {
    const root = new THREE.Group(), matrix = new THREE.Object3D(), colour = new THREE.Color()
    root.name = 'archipelago-reefs'
    const kits = [...new Set(reefStacks.map(s => s.kit))]
    for (const kit of kits) {
      const source = gltf.scene.getObjectByName(kit), stacks = reefStacks.filter(s => s.kit === kit)
      if (!(source instanceof THREE.Mesh)) continue
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, stacks.length)
      stacks.forEach((s, i) => {
        matrix.position.set(s.x, s.y, s.z); matrix.rotation.set(0, s.yaw, 0); matrix.scale.setScalar(s.scale); matrix.updateMatrix()
        mesh.setMatrixAt(i, matrix.matrix)
        // sea-worn stone, a shade darker and cooler than the shore kit, varied stack to stack
        const value = .78 + (Math.sin(s.x * 12.9 + s.z * 78.2) * 43758.5 % 1 + 1) % 1 * .16
        mesh.setColorAt(i, colour.setRGB(.9 * value, .95 * value, .96 * value))
      })
      mesh.name = `reef-${kit}`; mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere()
      root.add(mesh)
    }
    return root
  }, [gltf.scene])
  useEffect(() => () => reefs.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose() }), [reefs])

  const buoy = useMemo(() => {
    const float = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .4, .55, 10), new THREE.MeshStandardMaterial({ color: '#9a4a3a', roughness: .8 }), buoys.length)
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(.045, .06, 1.25, 6), new THREE.MeshStandardMaterial({ color: '#5e4330', roughness: .9 }), buoys.length)
    const lampMaterial = new THREE.MeshStandardMaterial({ color: '#f1d9a4', emissive: '#ffb45c', emissiveIntensity: 0, roughness: .5 })
    const lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .24, .2), lampMaterial, buoys.length)
    const root = new THREE.Group(); root.name = 'archipelago-buoys'
    for (const mesh of [float, post, lamp]) { mesh.castShadow = true; mesh.frustumCulled = false; mesh.raycast = () => {}; root.add(mesh) }
    return { root, float, post, lamp, lampMaterial }
  }, [])
  useEffect(() => () => { for (const mesh of [buoy.float, buoy.post, buoy.lamp]) { mesh.geometry.dispose(); mesh.dispose() }; (buoy.float.material as THREE.Material).dispose(); (buoy.post.material as THREE.Material).dispose(); buoy.lampMaterial.dispose() }, [buoy])
  const runtime = useRef(buoy)
  const reduced = useRef(false)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), changed = () => { reduced.current = media.matches }
    changed(); media.addEventListener('change', changed); return () => media.removeEventListener('change', changed)
  }, [])
  useFrame(({ clock }) => {
    const t = reduced.current ? 0 : clock.elapsedTime, dummy = new THREE.Object3D(), part = new THREE.Matrix4(), buoy = runtime.current
    buoys.forEach((b, i) => {
      // a slow bob and a little roll, each buoy out of step with the next; post and lamp ride the float's tilt
      const y = seaLevel + .04 + Math.sin(t * 1.1 + b.phase) * .06, tilt = Math.sin(t * .8 + b.phase * 1.3) * .08
      dummy.rotation.set(tilt, b.phase, tilt * .6); dummy.position.set(b.x, y, b.z); dummy.updateMatrix()
      buoy.float.setMatrixAt(i, dummy.matrix)
      buoy.post.setMatrixAt(i, part.makeTranslation(0, .85, 0).premultiply(dummy.matrix))
      buoy.lamp.setMatrixAt(i, part.makeTranslation(0, 1.55, 0).premultiply(dummy.matrix))
    })
    for (const mesh of [buoy.float, buoy.post, buoy.lamp]) mesh.instanceMatrix.needsUpdate = true
    buoy.lampMaterial.emissiveIntensity = .15 + 2.6 * lanternPower(daylightAt(useForestStore.getState()))
  })
  return <group><primitive object={reefs} dispose={null} /><primitive object={buoy.root} dispose={null} /></group>
}
