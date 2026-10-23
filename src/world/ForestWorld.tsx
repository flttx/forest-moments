import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useForestStore } from '../game/store'
import { canStandAt, dockDeckHeight, groundHeightAt, moveOnGround } from '../game/movement'
import { lookoutPosition, workshopPosition } from './assets'
import { canBoard, canLand, stepBoat } from '../game/rowing'
import { RowingBoat } from './RowingBoat'
import { fishingClips } from '../game/fishing'
import { FishingScene } from './FishingScene'
import { ModelAsset } from './ModelAsset'
import type { Locomotion } from './ModelAsset'
import { Atmosphere } from './Atmosphere'
import { IslandTerrain } from './IslandTerrain'
import { ForestVegetation } from './ForestVegetation'

const qaEnabled = import.meta.env.DEV && new URLSearchParams(location.search).has('qa')

/** Fixed, opt-in development views for repeatable before/after captures. */
function ReviewCamera() {
  const view = new URLSearchParams(location.search).get('view')
  useFrame(({ camera }) => {
    if (!qaEnabled || !view) return
    const views: Record<string, [number[], number[]]> = {
      overview: [[34, 28, 42], [0, 0, 0]],
      coast: [[24, 4, 27], [0, 1, 0]],
      pond: [[14, 6, 4], [6, .4, -5]],
      workshop: [[-1, 4, 12], [-8, 1.3, 3]],
      tower: [[1, 5, 2], [-8, 2, -8]],
      farm: [[15, 4, 13], [8, .6, 6]],
      player: [[3, 2.5, 5], [0, .8, 0]],
    }
    const shot = views[view]
    if (shot) { camera.position.set(shot[0][0], shot[0][1], shot[0][2]); camera.lookAt(shot[1][0], shot[1][1], shot[1][2]) }
  }, -1)
  return null
}

function Workshop() {
  return <group position={[...workshopPosition]}>
    <Suspense fallback={null}><ModelAsset asset="workshop" /></Suspense>
  </group>
}

function Tower() {
  return <group position={[...lookoutPosition]}>
    <Suspense fallback={null}><ModelAsset asset="lookout" /></Suspense>
  </group>
}

function Farm() {
  return <group position={[8, 0, 6]}>
    {[-2, -1, 0, 1, 2].flatMap((i) => [
      <mesh key={'n' + i} position={[i, .45, -2]}><boxGeometry args={[.12, .9, .12]} /><meshStandardMaterial color="#b18859" /></mesh>,
      <mesh key={'s' + i} position={[i, .45, 2]}><boxGeometry args={[.12, .9, .12]} /><meshStandardMaterial color="#b18859" /></mesh>,
    ])}
    {[-1, 0, 1].flatMap((i) => [
      <mesh key={'e' + i} position={[2, .45, i]}><boxGeometry args={[.12, .9, .12]} /><meshStandardMaterial color="#b18859" /></mesh>,
      <mesh key={'w' + i} position={[-2, .45, i]}><boxGeometry args={[.12, .9, .12]} /><meshStandardMaterial color="#b18859" /></mesh>,
    ])}
    <mesh position={[0, .65, 0]} castShadow><boxGeometry args={[1.55, 1.3, 1.35]} /><meshStandardMaterial color="#b58b65" /></mesh>
    <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[1.34, 1, 4]} /><meshStandardMaterial color="#665348" /></mesh>
  </group>
}

function Water() {
  return <group>
    <mesh position={[10.15, dockDeckHeight - .08, -8.15]}><boxGeometry args={[2.8, .16, 1.2]} /><meshStandardMaterial color="#967450" /></mesh>
    <Suspense fallback={null}><RowingBoat /></Suspense>
  </group>
}

function Lamp({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <mesh castShadow position={[0, 1.18, 0]}><cylinderGeometry args={[.09, .13, 2.36, 8]} /><meshStandardMaterial color="#655240" /></mesh>
    <mesh position={[0, 2.45, 0]}><sphereGeometry args={[.23, 10, 10]} /><meshStandardMaterial color="#f3bf72" emissive="#d69a46" emissiveIntensity={.65} /></mesh>
    <pointLight position={[0, 2.4, 0]} color="#ffcd91" intensity={1.2} distance={5} />
  </group>
}

function Player() {
  const root = useRef<THREE.Group>(null)
  const motion = useRef<Locomotion>('idle')
  const ready = useRef(false)
  const onReadyChange = useCallback((value: boolean) => { ready.current = value }, [])
  const pressed = useRef(new Set<string>())
  const updatePosition = useForestStore((s) => s.updatePosition)

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || (useForestStore.getState().mode === 'fishing' && ['Space', 'Escape'].includes(e.code))) {
        e.preventDefault()
        pressed.current.add(e.code)
        if (e.code === 'KeyF' && !e.repeat && ready.current) useForestStore.getState().interact()
        if (e.code === 'Space') useForestStore.getState().reel(true)
        if (e.code === 'Escape') useForestStore.getState().cancelFishing()
      }
    }
    function up(e: KeyboardEvent) { pressed.current.delete(e.code); if (e.code === 'Space') useForestStore.getState().reel(false) }
    function blur() { pressed.current.clear(); useForestStore.getState().pauseFishing() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', blur)
    }
  }, [])

  useFrame(({ camera }, delta) => {
    const character = root.current
    if (!character) return
    const dt = Math.min(delta, .05)
    const keys = pressed.current
    const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
    const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const speed = running ? 3.08 : 1.1
    motion.current = 'idle'
    const state = useForestStore.getState()
    character.visible = state.mode !== 'rowing'
    // Store position also supplies the safe landing point after leaving the boat.
    character.position.set(state.position.x, groundHeightAt(state.position.x, state.position.z), state.position.z)
    if (state.mode === 'rowing') state.updateBoat(stepBoat(state.boat, -z, -x, dt))
    if (state.mode === 'fishing') {
      state.tickFishing(dt)
      const f = useForestStore.getState().fishing
      if (f) motion.current = fishingClips[f.phase]
      character.rotation.y = -Math.PI / 2
    }
    if (state.mode === 'walking' && ready.current && (x !== 0 || z !== 0)) {
      const length = Math.hypot(x, z)
      const next = moveOnGround(character.position, x / length * speed * dt, z / length * speed * dt)
      if (Math.hypot(next.x - character.position.x, next.z - character.position.z) > .00001) {
        character.position.set(next.x, groundHeightAt(next.x, next.z), next.z)
        motion.current = running ? 'run' : 'walk'
      }
      const difference = Math.atan2(-x, -z) - character.rotation.y
      character.rotation.y += Math.atan2(Math.sin(difference), Math.cos(difference)) * (1 - Math.exp(-12 * dt))
    }
    if (state.mode === 'walking') updatePosition(character.position.x, character.position.z)
    const current = useForestStore.getState()
    const target = current.mode === 'rowing' ? current.boat : character.position
    const offset = current.mode === 'fishing' ? new THREE.Vector3(-1.8, 3.2, 5) : current.mode === 'rowing' ? new THREE.Vector3(4.2, 5, 6.2) : new THREE.Vector3(8, 5.8, 8)
    camera.position.lerp(offset.add(new THREE.Vector3(target.x, 0, target.z)), 1 - Math.exp(-3 * dt))
    camera.lookAt(target.x + (current.mode === 'fishing' ? 1 : 0), .85, target.z)
  }, -2)

  useFrame(({ gl, scene }) => {
    // Opt-in, read-only local QA telemetry; removed from production builds.
    if (qaEnabled && root.current) {
      const current = useForestStore.getState()
      const models = ['raccoon', 'workshop', 'lookout', 'canoe'].filter((name) => scene.getObjectByName(`asset-${name}`))
      gl.domElement.dataset.forestQa = JSON.stringify({
        position: root.current.position.toArray(), motion: motion.current, ready: ready.current, models,
        animation: scene.getObjectByName('asset-raccoon')?.userData.animation,
        mode: current.mode, boat: current.boat, boatReady: current.boatReady,
        canBoard: canBoard(current.position.x, current.position.z, current.boat), canLand: canLand(current.boat),
        boatAnimation: scene.getObjectByName('asset-canoe')?.userData.animation,
        fishing: current.fishing, fishingReady: current.fishingReady, fishBook: current.fishBook,
        fishingVisual: scene.getObjectByName('fishing-tools')?.userData.qa,
        triangles: gl.info.render.triangles, calls: gl.info.render.calls,
      })
    }
  })

  return <group ref={root}>
    <Suspense fallback={null}><ModelAsset asset="raccoon" motion={motion} onReadyChange={onReadyChange} /></Suspense>
  </group>
}

function Grove() {
  const planted = useForestStore((s) => s.planted)
  if (!planted) return null
  return <group position={[0, 0, 8]}>
    <mesh position={[0, .4, 0]} castShadow><cylinderGeometry args={[.08, .11, .8, 8]} /><meshStandardMaterial color="#886446" /></mesh>
    <mesh position={[0, 1.05, 0]} castShadow><coneGeometry args={[.59, 1.24, 8]} /><meshStandardMaterial color="#7aa575" flatShading /></mesh>
  </group>
}

function Scene() {
  const stones = useMemo(() => Array.from({ length: 36 }, (_, i) => {
    const a = i * 2.399
    const r = 9 + ((i * 11) % 17) * .5
    return [Math.sin(a) * r, Math.cos(a) * r] as const
  }).filter(([x, z]) => canStandAt(x, z) && groundHeightAt(x, z) === 0), [])
  return <>
    <Atmosphere />
    <IslandTerrain />
    <ForestVegetation />
    {stones.map(([x, z], i) => <mesh key={i} position={[x, .13, z]} scale={[1, .44, .8]} rotation={[0, i, 0]}>
      <icosahedronGeometry args={[.36, 1]} /><meshStandardMaterial color="#9f9e86" roughness={.95} />
    </mesh>)}
    <Workshop />
    <Tower />
    <Farm />
    <Water />
    <Grove />
    <Lamp x={-3} z={-3} />
    <Lamp x={-3} z={5} />
    <Lamp x={3} z={1} />
    <Player />
    {import.meta.env.DEV && <ReviewCamera />}
    <Suspense fallback={null}><FishingScene /></Suspense>
  </>
}

export function ForestWorld() {
  return <Canvas shadows dpr={[1, 1.7]} camera={{ position: [8, 5.8, 8], fov: 46, far: 600 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} style={{ height: '100%', width: '100%' }}>
    <Suspense fallback={null}><Scene /></Suspense>
  </Canvas>
}
