import * as THREE from 'three'
/** Quantised integer attributes must become floats before applying a metre-space transform. */
export function transformedGeometry(source:THREE.BufferGeometry,matrix:THREE.Matrix4) {
  const geometry=source.clone()
  for(const name of ['position','normal']) {
    const a=source.getAttribute(name)
    if(!a)continue
    const values=new Float32Array(a.count*3)
    for(let i=0;i<a.count;i++)values.set([a.getX(i),a.getY(i),a.getZ(i)],i*3)
    geometry.setAttribute(name,new THREE.BufferAttribute(values,3))
  }
  return geometry.applyMatrix4(matrix)
}
