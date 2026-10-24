import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, FileLoader, Group, Mesh, Quaternion, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useForestStore } from '../game/store'
import {boatSurfacePose} from '../game/boatPresentation'
import {BoatWaterFeedback} from './BoatWaterFeedback'
import {seaLevel} from './worldConfig'
import { modelAssets } from './assets'

interface PropTrack {
  scale: number
  sampleFPS: number
  frames: { position: [number, number, number]; quaternion: [number, number, number, number] }[]
}

/** Same assembly transforms and prop samples as the validated center-seat-v11 review. */
export function RowingBoat() {
  const boatGltf = useGLTF('/assets/models/canoe-center-seat.glb')
  const sourceBoat = useGLTF('/assets/models/paddle.glb')
  const actorGltf = useGLTF(modelAssets.raccoon.url)
  const trackFile = useLoader(FileLoader, '/assets/models/paddle-track.json')
  const track = useMemo(() => JSON.parse(String(trackFile)) as PropTrack, [trackFile])
  const root = useRef<Group>(null)
  const reducedMotion=useRef(false),surfaceTime=useRef(0)
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>{reducedMotion.current=media.matches}
    update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)
  },[])
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
    const blade=parts.find(p=>p.name.startsWith('Paddle_blade'))
    if(!blade)throw new Error('Original paddle blade is missing')
    return { hull, character, paddle,blade, mixer, action, nextPosition: new Vector3(), nextRotation: new Quaternion() }
  }, [actorGltf, boatGltf.scene, sourceBoat.scene, track.scale])
  const runtime = useRef(assembly)
  useEffect(() => {
    runtime.current = assembly
    assembly.action.play()
    useForestStore.getState().setBoatReady(true)
    return () => { useForestStore.getState().setBoatReady(false); assembly.mixer.stopAllAction() }
  }, [assembly])
  useFrame((_,delta) => {
    if (!root.current) return
    const assembly = runtime.current
    const { boat, mode } = useForestStore.getState()
    surfaceTime.current+=Math.min(delta,.05)
    const surface=boatSurfacePose(boat,surfaceTime.current,reducedMotion.current)
    root.current.position.set(boat.x, seaLevel + .355+surface.heave, boat.z)
    root.current.rotation.order='YXZ'
    root.current.rotation.set(surface.roll,boat.heading,surface.pitch)
    assembly.character.visible = mode === 'rowing'
    assembly.paddle.visible = mode === 'rowing'
    assembly.mixer.setTime(boat.phase)
    const f = boat.phase * track.sampleFPS
    const index = Math.min(Math.floor(f), track.frames.length - 2)
    const a = track.frames[index], b = track.frames[index + 1], u = f - index
    assembly.paddle.position.fromArray(a.position).lerp(assembly.nextPosition.fromArray(b.position), u)
    assembly.paddle.position.y += .26
    assembly.paddle.quaternion.fromArray(a.quaternion).slerp(assembly.nextRotation.fromArray(b.quaternion), u)
    if(import.meta.env.DEV)root.current.userData.surface=surface
    if (import.meta.env.DEV) root.current.userData.animation = { clip: 'paddle', time: assembly.action.time, phase: boat.phase, original: true }
  }, -1)
  return <><group ref={root} name="asset-canoe">
    <primitive object={assembly.hull} dispose={null} />
    <primitive object={assembly.character} dispose={null} />
    <primitive object={assembly.paddle} dispose={null} />
  </group><BoatWaterFeedback blade={assembly.blade} reducedMotion={reducedMotion}/></>
}
