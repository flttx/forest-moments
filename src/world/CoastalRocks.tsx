import { useMemo, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { coastPieces, type CoastKit } from './coastalLayout'

/** Hand-made Blender coastal kit (scripts/build_coastal_kit.py), one instanced mesh per module, placed by coastalLayout. */
export function CoastalRocks() {
  const gltf = useGLTF('/assets/expansion/coastal-kit.glb')
  const group = useMemo(() => {
    const root = new THREE.Group(), matrix = new THREE.Object3D()
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
