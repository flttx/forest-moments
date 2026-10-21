import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useForestStore } from '../game/store'

const pinePositions = Array.from({ length: 66 }, (_, i) => {
  const a = i * 2.3999632
  const r = 11 + ((i * 29) % 22) * 0.31
  return { x: Math.sin(a) * r, z: Math.cos(a) * r, scale: 0.78 + (i % 6) * 0.11 }
}).filter(({ x, z }) => !(x < -5 && z > -10 && z < 6) && !(x > 3 && z > -10 && z < 9))

function Pine({ x, z, scale }: { x: number; z: number; scale: number }) {
  return <group position={[x, 0, z]} scale={scale}>
    <mesh castShadow position={[0, .75, 0]}><cylinderGeometry args={[.17, .25, 1.5, 7]} /><meshStandardMaterial color="#735842" /></mesh>
    {[0, 1, 2].map((i) => <mesh key={i} castShadow position={[0, 1.75 + i * .64, 0]}>
      <coneGeometry args={[1.08 - i * .18, 1.9, 7]} />
      <meshStandardMaterial flatShading color={i % 2 ? '#5e816a' : '#416955'} roughness={1} />
    </mesh>)}
  </group>
}

function Workshop() {
  return <group position={[-8, 0, 3]}>
    <mesh castShadow position={[0, 1.3, 0]}><boxGeometry args={[3.5, 2.6, 3]} /><meshStandardMaterial color="#ad8057" /></mesh>
    <mesh castShadow position={[0, 3, 0]} rotation={[0, Math.PI / 4, 0]}>
      <coneGeometry args={[2.75, 1.9, 4]} /><meshStandardMaterial flatShading color="#464846" />
    </mesh>
    <mesh position={[.5, .97, 1.52]}><boxGeometry args={[.95, 1.9, .1]} /><meshStandardMaterial color="#5c4837" /></mesh>
    <mesh position={[-.9, 1.75, 1.52]}><boxGeometry args={[.68, .7, .12]} /><meshStandardMaterial color="#f1c784" emissive="#a46e2a" emissiveIntensity={.22} /></mesh>
  </group>
}

function Tower() {
  return <group position={[-8, 0, -8]}>
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={String(x) + ':' + String(z)} castShadow position={[x, 2.05, z]}>
      <cylinderGeometry args={[.15, .2, 4.1, 6]} /><meshStandardMaterial color="#77563c" />
    </mesh>))}
    <mesh castShadow position={[0, 3.95, 0]}><boxGeometry args={[2.8, .3, 2.8]} /><meshStandardMaterial color="#a17a50" /></mesh>
    <mesh castShadow position={[0, 5.15, 0]} rotation={[0, Math.PI / 4, 0]}>
      <coneGeometry args={[2.4, 1.8, 4]} /><meshStandardMaterial color="#485147" flatShading />
    </mesh>
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, .035, -5]}>
      <circleGeometry args={[4.05, 64]} />
      <meshStandardMaterial color="#7baab0" roughness={.22} metalness={.08} transparent opacity={.86} />
    </mesh>
    <mesh position={[10.15, .22, -8.15]}><boxGeometry args={[2.8, .34, 1.2]} /><meshStandardMaterial color="#967450" /></mesh>
    <mesh position={[11.1, .32, -6.8]} rotation={[0, -.4, 0]}>
      <boxGeometry args={[1.65, .35, .85]} /><meshStandardMaterial color="#a2764e" />
    </mesh>
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
  const tail = useRef<THREE.Group>(null)
  const pressed = useRef(new Set<string>())
  const walkClock = useRef(0)
  const updatePosition = useForestStore((s) => s.updatePosition)

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault()
        pressed.current.add(e.code)
        if (e.code === 'KeyF' && !e.repeat) useForestStore.getState().interact()
      }
    }
    function up(e: KeyboardEvent) { pressed.current.delete(e.code) }
    function blur() { pressed.current.clear() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useFrame(({ camera }, delta) => {
    const character = root.current
    if (!character) return
    const dt = Math.min(delta, .05)
    const keys = pressed.current
    const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
    const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))
    const moving = x !== 0 || z !== 0
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.1 : 2.8
    if (moving) {
      const length = Math.hypot(x, z)
      const nx = character.position.x + x / length * speed * dt
      const nz = character.position.z + z / length * speed * dt
      if (Math.hypot(nx, nz) <= 16.4 && Math.hypot(nx - 6, nz + 5) >= 4.35) {
        character.position.set(nx, 0, nz)
      }
      character.rotation.y = Math.atan2(-x, -z)
    }
    walkClock.current += dt * (moving ? 12 : 2)
    if (tail.current) tail.current.rotation.x = .3 + Math.sin(walkClock.current) * (moving ? .13 : .035)
    updatePosition(character.position.x, character.position.z)
    camera.position.lerp(new THREE.Vector3(character.position.x + 8, 10, character.position.z + 13), 1 - Math.exp(-3 * dt))
    camera.lookAt(character.position.x, 1.1, character.position.z)
  })

  return <group ref={root}>
    <mesh castShadow position={[0, .85, 0]}><sphereGeometry args={[.52, 16, 12]} /><meshStandardMaterial color="#9e886e" /></mesh>
    <mesh castShadow position={[0, 1.5, -.14]}><sphereGeometry args={[.45, 16, 12]} /><meshStandardMaterial color="#a18b73" /></mesh>
    <mesh position={[0, 1.52, -.48]}><sphereGeometry args={[.35, 16, 12]} /><meshStandardMaterial color="#57504d" /></mesh>
    {[-.19, .19].map((x) => <mesh key={x} position={[x, 1.59, -.75]}><sphereGeometry args={[.07, 12, 8]} /><meshStandardMaterial color="#f8e4c7" /></mesh>)}
    {[-.31, .31].map((x) => <mesh key={x} position={[x, 1.88, -.04]}><sphereGeometry args={[.18, 12, 10]} /><meshStandardMaterial color="#514b49" /></mesh>)}
    {[-.27, .27].map((x) => <mesh key={x} position={[x, .28, -.12]}><sphereGeometry args={[.24, 12, 10]} /><meshStandardMaterial color="#5c524b" /></mesh>)}
    <group ref={tail} position={[0, .77, .47]}>
      {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[0, -.07 + i * .15, .05 * i]}>
        <sphereGeometry args={[.23 - i * .022, 12, 10]} />
        <meshStandardMaterial color={i % 2 ? '#b0a18a' : '#554b46'} />
      </mesh>)}
    </group>
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
  }), [])
  return <>
    <color attach="background" args={['#d7e5d7']} />
    <fog attach="fog" args={['#d7e5d7', 30, 72]} />
    <ambientLight intensity={1.4} color="#fff2de" />
    <directionalLight position={[-9, 18, 8]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={26} shadow-camera-bottom={-26} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[19, 96]} /><meshStandardMaterial color="#779669" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.25, 0]}><circleGeometry args={[22, 96]} /><meshStandardMaterial color="#9c8c69" /></mesh>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-2, .012, 0]}><planeGeometry args={[3, 20]} /><meshStandardMaterial color="#b1a084" roughness={1} /></mesh>
    {pinePositions.map((position, i) => <Pine key={i} {...position} />)}
    {stones.map(([x, z], i) => <mesh key={i} position={[x, .13, z]} scale={[1, .44, .8]} rotation={[0, i, 0]}>
      <dodecahedronGeometry args={[.36, 0]} /><meshStandardMaterial color="#9f9e86" flatShading />
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
  </>
}

export function ForestWorld() {
  return <Canvas shadows dpr={[1, 1.7]} camera={{ position: [8, 10, 13], fov: 46 }} gl={{ antialias: true }} style={{ height: '100%', width: '100%' }}>
    <Suspense fallback={null}><Scene /></Suspense>
  </Canvas>
}
