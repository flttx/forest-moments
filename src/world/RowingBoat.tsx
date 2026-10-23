import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, FileLoader, Group, Mesh, Quaternion, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useForestStore } from '../game/store'
import { pond } from '../game/rowing'
import { modelAssets } from './assets'

interface PropTrack {
  scale: number
  sampleFPS: number
  frames: { position: [number, number, number]; quaternion: [number, number, number, number] }[]
}

/** Same assembly transforms and prop samples as the validated center-seat-v11 review. */
export function RowingBoat() {
  const boatGltf = useGLTF('/assets/models/canoe-center-seat.glb')
  const sourceBoat = useGLTF(modelAssets.canoe.url)
  const actorGltf = useGLTF(modelAssets.raccoon.url)
  const trackFile = useLoader(FileLoader, '/assets/models/paddle-track.json')
  const track = useMemo(() => JSON.parse(String(trackFile)) as PropTrack, [trackFile])
  const root = useRef<Group>(null)
  const wake = useRef<Group>(null)
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const assembly = useMemo(() => {
    const hull = clone(boatGltf.scene)
    const actor = clone(actorGltf.scene)
    const character = new Group()
    character.add(actor)
    character.scale.setScalar(1.4 / .6)
    character.rotation.y = Math.PI / 2
    character.position.set(-.012988392263650894, .6298368072509766, -.013671868480741978)
    const source = clone(sourceBoat.scene)
    source.updateMatrixWorld(true)
    const paddle = new Group()
    const parts: Mesh[] = []
    source.traverse((o) => { if (o instanceof Mesh && o.name.startsWith('Paddle_')) parts.push(o) })
    if (parts.length !== 2) throw new Error('Original paddle meshes are missing')
    for (const part of parts) {
      const native = part.matrixWorld.clone()
      paddle.add(part)
      native.decompose(part.position, part.quaternion, part.scale)
    }
    paddle.scale.setScalar(track.scale)
    const clip = actorGltf.animations.find((a) => a.name === 'paddle')
    if (!clip) throw new Error('Original paddle animation is missing')
    const mixer = new AnimationMixer(actor)
    const action = mixer.clipAction(clip)
    for (const object of [hull, character, paddle]) object.traverse((o) => {
      if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true }
    })
    return { hull, character, paddle, mixer, action, nextPosition: new Vector3(), nextRotation: new Quaternion() }
  }, [actorGltf, boatGltf.scene, sourceBoat.scene, track.scale])
  const runtime = useRef(assembly)
  useEffect(() => {
    runtime.current = assembly
    assembly.action.play()
    useForestStore.getState().setBoatReady(true)
    return () => { useForestStore.getState().setBoatReady(false); assembly.mixer.stopAllAction() }
  }, [assembly])
  useFrame(({ clock }) => {
    if (!root.current) return
    const assembly = runtime.current
    const { boat, mode } = useForestStore.getState()
    root.current.position.set(boat.x, pond.waterY + .355, boat.z)
    root.current.rotation.y = boat.heading
    assembly.character.visible = mode === 'rowing'
    assembly.paddle.visible = mode === 'rowing'
    assembly.mixer.setTime(boat.phase)
    const f = boat.phase * track.sampleFPS
    const index = Math.min(Math.floor(f), track.frames.length - 2)
    const a = track.frames[index], b = track.frames[index + 1], u = f - index
    assembly.paddle.position.fromArray(a.position).lerp(assembly.nextPosition.fromArray(b.position), u)
    assembly.paddle.position.y += .26
    assembly.paddle.quaternion.fromArray(a.quaternion).slerp(assembly.nextRotation.fromArray(b.quaternion), u)
    if (wake.current) {
      wake.current.visible = mode === 'rowing' && boat.effort > .08 && !reducedMotion
      wake.current.children.forEach((ripple, i) => {
        const age = (clock.elapsedTime * .55 + i / 4) % 1
        ripple.position.set(-1.6 - age * .35, -.351, 0)
        ripple.scale.set(.5 + age * .7, .3 + age * .4, 1)
        const x = boat.x + ripple.position.x * Math.cos(boat.heading)
        const z = boat.z - ripple.position.x * Math.sin(boat.heading)
        ripple.visible = Math.hypot(x - pond.x, z - pond.z) + .68 * ripple.scale.x < pond.radius
      })
    }
    if (import.meta.env.DEV) root.current.userData.animation = { clip: 'paddle', time: assembly.action.time, phase: boat.phase, original: true }
  }, -1)
  return <group ref={root} name="asset-canoe">
    <primitive object={assembly.hull} dispose={null} />
    <primitive object={assembly.character} dispose={null} />
    <primitive object={assembly.paddle} dispose={null} />
    <group ref={wake}>
      {[0, 1, 2, 3].map((i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <ringGeometry args={[.65, .68, 36]} /><meshBasicMaterial color="#d4e5da" transparent opacity={.32} depthWrite={false} />
      </mesh>)}
    </group>
  </group>
}
