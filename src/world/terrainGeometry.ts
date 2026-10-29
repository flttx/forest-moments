import {BufferGeometry,Float32BufferAttribute} from 'three'
import {islandShape,pond} from './worldConfig'
import {terrainHeight} from './terrain'
import {sandRect} from '../game/sand'
import {westLand} from './westExpansion'

/** 30 cm island grid; 6 cm cells around the pond prevent a sawtooth waterline, and 10 cm cells on the south beach's
 * play sand carry the dug and heaped relief (sandField). Both refinement boundaries sit on flat or gently curving
 * ground, so the shared edges stay closed to well under a millimetre.
 */
export function createTerrainGeometry(){
  const size=islandShape.meshSize,coarse=320,step=size/coarse,sub=15
  const positions:number[]=[],indices:number[]=[],vertices=new Map<string,number>()
  const vertex=(ix:number,iz:number)=>{
    const key=`${ix},${iz}`,existing=vertices.get(key)
    if(existing!==undefined)return existing
    const x=ix*step/sub-size/2,z=iz*step/sub-size/2,i=positions.length/3
    positions.push(x,terrainHeight(x,z),z);vertices.set(key,i);return i
  }
  // Add only western columns, preserving the old 30/6/10 cm sampling and every original grid coordinate.
  const firstX=Math.round((westLand.minX+size/2)/step)
  for(let z=0;z<coarse;z++)for(let x=firstX;x<coarse;x++){
    const cx=(x+.5)*step-size/2,cz=(z+.5)*step-size/2
    const pondCell=Math.hypot(cx-pond.x,cz-pond.z)<5.05,sandCell=cx>sandRect.minX&&cx<sandRect.maxX&&cz>sandRect.minZ&&cz<sandRect.maxZ
    const count=pondCell?5:sandCell?3:1,inc=sub/count
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
