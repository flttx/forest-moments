import { useMemo, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { coastPieces, type CoastKit } from './coastalLayout'
import { mistRadius } from './mistIsland'
import { autumnRadius } from './autumnIsland'
import { tideRadius } from './tideIsland'

// One kit, four shores: cool grey stone on Mist, ochre on Autumn, sun-warmed sandstone on Tide; the main island and driftwood keep the kit colour.
const islandTints = { mist: [.9, .97, .94], autumn: [1.02, .92, .78], tide: [1.08, .93, .76], main: [1, 1, 1] } as const
function rockTint(kit: CoastKit, x: number, z: number) {
  if (kit.startsWith('Driftwood')) return islandTints.main
  return mistRadius(x, z) < 1.4 ? islandTints.mist : autumnRadius(x, z) < 1.4 ? islandTints.autumn : tideRadius(x, z) < 1.4 ? islandTints.tide : islandTints.main
}

/** Hand-made Blender coastal kit (scripts/build_coastal_kit.py), one instanced mesh per module, placed by coastalLayout. */
export function CoastalRocks() {
  const gltf = useGLTF('/assets/expansion/coastal-kit.glb')
  const group = useMemo(() => {
    const root = new THREE.Group(), matrix = new THREE.Object3D(), colour = new THREE.Color()
    root.name = 'coastal-kit'
    const byKit = new Map<CoastKit, typeof coastPieces>()
    for (const p of coastPieces) byKit.set(p.kit, [...(byKit.get(p.kit) ?? []), p])
    for (const [kit, pieces] of byKit) {
      const source = gltf.scene.getObjectByName(kit)
      if (!(source instanceof THREE.Mesh)) continue
      const rocks = new THREE.InstancedMesh(source.geometry, source.material, pieces.length)
      pieces.forEach((p, i) => {
        matrix.position.set(p.x, p.y, p.z); matrix.rotation.set(0, p.yaw, 0); matrix.scale.setScalar(p.scale); matrix.updateMatrix()
        rocks.setMatrixAt(i, matrix.matrix)
        // a small per-stone value shift so neighbouring copies of a module do not match exactly
        const tint = rockTint(kit, p.x, p.z), [r, g, b] = tint
        const value = tint === islandTints.main ? 1 : .92 + (Math.sin(p.x * 12.9 + p.z * 78.2) * 43758.5 % 1 + 1) % 1 * .14
        rocks.setColorAt(i, colour.setRGB(r * value, g * value, b * value))
      })
      rocks.name = `coastal-${kit}`
      rocks.castShadow = true; rocks.receiveShadow = true
      rocks.computeBoundingSphere()
      root.add(rocks)
    }
    root.userData.qa = { pieces: coastPieces.length }
    return root
  }, [gltf.scene])
  // Geometry and material belong to the cached GLTF; only the instance buffers are ours to free.
  useEffect(() => () => group.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose() }), [group])
  return <primitive object={group} dispose={null} />
}
