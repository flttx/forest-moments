import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useForestStore } from '../game/store'
import { useInventoryStore } from '../game/inventoryStore'
import { curioIds, type CurioId } from '../game/curios'

/** East-wall shelf in the bedroom (inside the walkable x limit of 3.65), well above the tank and the table. */
const shelf = { x: 3.62, y: 1.35, z: .55 }

const wood = () => new THREE.MeshStandardMaterial({ color: '#7a5536', roughness: .85 })
/** Each curio as a small hand-sized object, laid out left to right along the plank. */
function curio(id: CurioId) {
  const g = new THREE.Group(), brass = new THREE.MeshStandardMaterial({ color: '#b08a45', roughness: .45, metalness: .6 })
  if (id === 'compass') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .018, 18), brass))
    const face = new THREE.Mesh(new THREE.CircleGeometry(.038, 18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: .6 })); face.position.y = .0095; g.add(face)
    const needle = new THREE.Mesh(new THREE.BoxGeometry(.006, .002, .06), new THREE.MeshStandardMaterial({ color: '#a33a2a' })); needle.position.y = .011; needle.rotation.y = .4; g.add(needle)
  } else if (id === 'button') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .008, 16), brass); b.rotation.x = 1.2; b.position.y = .02; g.add(b)
  } else if (id === 'marble') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.018, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#9cc4cf', roughness: .1, transmission: .4, thickness: .02 })); m.position.y = .018; g.add(m)
  } else if (id === 'whistle') {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.014, .016, .09, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#9a7046', roughness: .8 })); w.position.y = .016; g.add(w)
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.016, .004, 6, 14), brass); ring.position.set(-.03, .006, 0); ring.rotation.x = Math.PI / 2; g.add(ring)
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(.05, .006, .008), brass); shaft.position.set(.005, .006, 0); g.add(shaft)
    const bit = new THREE.Mesh(new THREE.BoxGeometry(.008, .006, .018), brass); bit.position.set(.026, .006, .009); g.add(bit)
  }
  return g
}

/** The curios found in the Mist Isle logs, and a few shore finds once the satchel has held them. */
export function BedroomShelf() {
  const found = useForestStore(s => s.curiosBook.found)
  const shore = useInventoryStore(s => s.inv.found.filter(id => id === 'shell' || id === 'seaGlass').join(','))
  const shells = useGLTF('./assets/expansion/shell-set.glb')
  const object = useMemo(() => {
    const g = new THREE.Group(); g.name = 'bedroom-shelf'
    const plank = new THREE.Mesh(new THREE.BoxGeometry(.22, .03, 1.1), wood()); plank.castShadow = true; plank.receiveShadow = true; g.add(plank)
    for (const z of [-.42, .42]) { const bracket = new THREE.Mesh(new THREE.BoxGeometry(.025, .14, .025), wood()); bracket.position.set(.09, -.085, z); g.add(bracket) }
    const items: THREE.Object3D[] = curioIds.filter(id => found.includes(id)).map(curio)
    if (shore.includes('shell')) for (const name of ['Shell_Scallop', 'Shell_Turban']) { const s = shells.scene.getObjectByName(name)?.clone(true); if (s) { s.position.set(0, 0, 0); s.scale.setScalar(1.6); items.push(s) } }
    if (shore.includes('seaGlass')) { const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(.022, 1).scale(1.3, .45, 1), new THREE.MeshPhysicalMaterial({ color: '#7fb59a', roughness: .55, transmission: .25, thickness: .02 })); glass.position.y = .01; items.push(new THREE.Group().add(glass)) }
    items.forEach((item, i) => { item.position.set(-.01, .015, -.45 + i * (.9 / Math.max(1, items.length - 1 || 1))); item.rotation.y = i * .7; g.add(item) })
    return g
  }, [found, shore, shells.scene])
  useEffect(() => () => object.traverse(o => { if (o instanceof THREE.Mesh && !o.name.startsWith('Shell_')) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } }), [object])
  return <primitive object={object} position={[shelf.x, shelf.y, shelf.z]} />
}
