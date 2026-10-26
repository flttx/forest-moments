import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pondLayout } from './pondLayout'

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

/** One cattail clump: tapered blades with a green-to-straw gradient, two with brown seed heads. */
function reedGeometry(): THREE.BufferGeometry {
  const random = rand(77)
  const position: number[] = [], color: number[] = [], index: number[] = []
  const base = new THREE.Color('#3f5a2a'), tip = new THREE.Color('#9aa35a'), head = new THREE.Color('#5a3a22')
  for (let b = 0; b < 7; b++) {
    const angle = random() * Math.PI * 2, offset = random() * 0.14, height = 0.9 + random() * 0.6, lean = 0.05 + random() * 0.18
    const [dx, dz] = [Math.cos(angle), Math.sin(angle)], [sx, sz] = [-dz, dx]
    const start = position.length / 3
    for (const [f, w] of [[0, 0.028], [0.5, 0.022], [1, 0]] as const) {
      const bend = lean * f * f, cx = dx * (offset + bend), cz = dz * (offset + bend), y = height * f
      const c = base.clone().lerp(tip, f)
      if (w === 0) { position.push(cx, y, cz); color.push(c.r, c.g, c.b) } else {
        position.push(cx - sx * w, y, cz - sz * w, cx + sx * w, y, cz + sz * w); color.push(c.r, c.g, c.b, c.r, c.g, c.b)
      }
    }
    index.push(start, start + 1, start + 2, start + 1, start + 3, start + 2, start + 2, start + 3, start + 4)
    if (b < 2) {
      // seed head: a short dark spindle standing just above the blades
      const topX = dx * (offset + lean), topZ = dz * (offset + lean)
      const s0 = position.length / 3
      for (const [yy, rr] of [[height - 0.02, 0.026], [height + 0.1, 0.034], [height + 0.2, 0]] as const)
        for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; position.push(topX + Math.cos(a) * rr, yy, topZ + Math.sin(a) * rr); color.push(head.r, head.g, head.b) }
      for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; index.push(s0 + k, s0 + n, s0 + 4 + k, s0 + n, s0 + 4 + n, s0 + 4 + k, s0 + 4 + k, s0 + 4 + n, s0 + 8 + k) }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  g.setIndex(index); g.computeVertexNormals()
  return g
}

/** Reed stands, stones, lily pads and a few flowers around the pond; the fishing bank and cast line stay open. */
export function PondLife() {
  const reduced = useRef(false)
  const time = useMemo(() => ({ value: 0 }), [])
  const data = pondLayout
  const geometries = useMemo(() => {
    const flower = new THREE.ConeGeometry(1, 1.2, 7); flower.translate(0, 0.6, 0)
    return { reed: reedGeometry(), pad: new THREE.CircleGeometry(1, 14, 0.35, Math.PI * 2 - 0.35), flower, stone: new THREE.IcosahedronGeometry(1, 0) }
  }, [])
  const reedMaterial = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
    m.onBeforeCompile = shader => {
      shader.uniforms.reedTime = time
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float reedTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float reedPhase = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7;
          float reedH = position.y * position.y;
          transformed.x += sin(reedTime * 1.3 + reedPhase) * 0.05 * reedH;
          transformed.z += cos(reedTime * 1.05 + reedPhase * 1.3) * 0.035 * reedH;`)
    }
    return m
  }, [time])
  const reedRef = useRef<THREE.InstancedMesh>(null), stoneRef = useRef<THREE.InstancedMesh>(null), padRef = useRef<THREE.InstancedMesh>(null), flowerRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const fill = (mesh: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => { if (!mesh) return; list.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true }
    fill(reedRef.current, data.reeds); fill(stoneRef.current, data.stones); fill(padRef.current, data.pads); fill(flowerRef.current, data.flowers)
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => { reduced.current = media.matches }; changed(); media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [data])
  useEffect(() => () => { Object.values(geometries).forEach(g => g.dispose()); reedMaterial.dispose() }, [geometries, reedMaterial])
  const runtime = useRef(time)
  useFrame((_, dt) => { if (!reduced.current) runtime.current.value += Math.min(dt, 0.05) })
  return <group name="pond-life">
    <instancedMesh ref={reedRef} name="pond-reeds" args={[geometries.reed, reedMaterial, data.reeds.length]} frustumCulled={false} receiveShadow />
    <instancedMesh ref={stoneRef} name="pond-stones" args={[geometries.stone, undefined, data.stones.length]} frustumCulled={false} receiveShadow castShadow>
      <meshStandardMaterial color="#8d8878" roughness={1} />
    </instancedMesh>
    <instancedMesh ref={padRef} name="pond-lily-pads" args={[geometries.pad, undefined, data.pads.length]} frustumCulled={false}>
      <meshStandardMaterial color="#4f7a34" roughness={0.7} side={THREE.DoubleSide} />
    </instancedMesh>
    <instancedMesh ref={flowerRef} name="pond-lily-flowers" args={[geometries.flower, undefined, data.flowers.length]} frustumCulled={false}>
      <meshStandardMaterial color="#e6b4c0" roughness={0.6} />
    </instancedMesh>
  </group>
}
