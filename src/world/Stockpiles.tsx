import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight } from './terrain'
import { hayBales, logPile } from './settlement'

/** Hay by the farm fence and a stacked log pile by the workshop; static props with no gameplay role. */
export function Stockpiles() {
  const logGeometry = useMemo(() => new THREE.CylinderGeometry(0.11, 0.11, 1.3, 8).rotateZ(Math.PI / 2), [])
  const logs = useMemo(() => {
    const rows = [[-0.26, 0], [0, 0], [0.26, 0], [-0.13, 0.21], [0.13, 0.21], [0, 0.42]] as const
    return rows.map(([dz, y], i) => ({ dz, y: y + 0.11, tilt: ((i * 37) % 10) / 100 - 0.05, len: 0.9 + ((i * 53) % 10) / 25 }))
  }, [])
  return <group name="stockpiles">
    {hayBales.map((b, i) => <group key={i} position={[b.x, terrainHeight(b.x, b.z) + b.y + 0.02, b.z]} rotation={[0, b.yaw, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow><boxGeometry args={[1, 0.5, 0.55]} /><meshStandardMaterial color="#c4a45a" roughness={1} /></mesh>
      {[-0.28, 0.28].map(x => <mesh key={x} position={[x, 0.25, 0]}><boxGeometry args={[0.05, 0.52, 0.58]} /><meshStandardMaterial color="#6b5430" roughness={1} /></mesh>)}
    </group>)}
    <group position={[logPile.x, terrainHeight(logPile.x, logPile.z), logPile.z]} rotation={[0, logPile.yaw, 0]}>
      {logs.map((l, i) => <mesh key={i} geometry={logGeometry} position={[0, l.y, l.dz]} rotation={[0, l.tilt, 0]} scale={[l.len / 1.3, 1, 1]} castShadow receiveShadow>
        <meshStandardMaterial color="#6e4a2c" roughness={1} />
      </mesh>)}
    </group>
  </group>
}
