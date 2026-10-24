import {BufferGeometry,Float32BufferAttribute} from 'three'
import {islandShape,pond} from './worldConfig'
import {terrainHeight} from './terrain'

/** 30 cm island grid; 6 cm cells around the pond prevent a sawtooth waterline.
 * The refinement boundary sits on the flat fishing clearing, so shared edges remain watertight.
 */
export function createTerrainGeometry(){
  const size=islandShape.meshSize,coarse=240,step=size/coarse,sub=5
  const positions:number[]=[],indices:number[]=[],vertices=new Map<string,number>()
  const vertex=(ix:number,iz:number)=>{
    const key=`${ix},${iz}`,existing=vertices.get(key)
    if(existing!==undefined)return existing
    const x=ix*step/sub-size/2,z=iz*step/sub-size/2,i=positions.length/3
    positions.push(x,terrainHeight(x,z),z);vertices.set(key,i);return i
  }
  for(let z=0;z<coarse;z++)for(let x=0;x<coarse;x++){
    const near=Math.hypot((x+.5)*step-size/2-pond.x,(z+.5)*step-size/2-pond.z)<5.05
    const count=near?sub:1,inc=sub/count
    for(let j=0;j<count;j++)for(let i=0;i<count;i++){
      const ix=x*sub+i*inc,iz=z*sub+j*inc
      const a=vertex(ix,iz),b=vertex(ix,iz+inc),c=vertex(ix+inc,iz+inc),d=vertex(ix+inc,iz)
      indices.push(a,b,d,b,c,d)
    }
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices)
  geometry.computeVertexNormals();geometry.computeBoundingSphere()
  return geometry
}
