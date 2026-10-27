import * as THREE from 'three'
import {species,type SpeciesId} from '../game/fishSpecies'

/**
 * Dresses a cloned koi as another kind: the koi texture is multiplied by the kind's tint, and glowing kinds get a soft
 * emissive of the same hue. Materials are copied on first use so the shared koi asset is never changed.
 */
export function dressFish(root:THREE.Object3D,kind:SpeciesId){
 const look=species[kind],tint=new THREE.Color(look.tint)
 root.traverse(o=>{
  if(!(o instanceof THREE.Mesh)||!(o.material instanceof THREE.MeshStandardMaterial))return
  if(!o.userData.ownMaterial){o.material=o.material.clone();o.userData.ownMaterial=true}
  const m=o.material as THREE.MeshStandardMaterial
  m.color.copy(tint)
  m.emissive.copy(look.glow?tint:new THREE.Color(0));m.emissiveIntensity=look.glow??0
  if(look.glow&&!m.emissiveMap)m.emissiveMap=m.map
 })
 root.userData.species=kind
}
