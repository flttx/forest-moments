import {BufferGeometry,Float32BufferAttribute} from 'three'
import {creekZ,creekWaterY} from '../game/expansion'
import {terrainHeight} from './terrain'
import {seaLevel,smoothRange} from './worldConfig'

/** Fit the water to the carved banks; the offshore tail dissolves above the ocean. */
export function creekSection(x:number){
 const z=creekZ(x),y=creekWaterY(x)
 const width=(side:number)=>{
  let lo=0,hi=2.2
  if(terrainHeight(x,z)>=y)return 0
  for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(terrainHeight(x,z+side*mid)<y)lo=mid;else hi=mid}
  return (lo+hi)/2*Math.sqrt(1-smoothRange(x,-10,-8.8))
 }
 return {x,y,z,left:width(-1),right:width(1),opacity:smoothRange(y-seaLevel,.025,.24)*(1-smoothRange(x,-9.8,-8.8))}
}
export function createCreekGeometry(){
 const positions:number[]=[],uvs:number[]=[],alpha:number[]=[],indices:number[]=[]
 const rows=320,columns=8
 for(let i=0;i<=rows;i++){
  const x=-40+31.2*i/rows,s=creekSection(x)
  for(let j=0;j<=columns;j++){
   const t=j/columns,offset=-s.left+(s.left+s.right)*t
   positions.push(x,s.y+.008,s.z+offset);uvs.push((x+40)/3,t);alpha.push(s.opacity)
   if(i<rows&&j<columns){const k=i*(columns+1)+j;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1)}
  }
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uvs,2));g.setAttribute('streamAlpha',new Float32BufferAttribute(alpha,1));g.setIndex(indices);g.computeVertexNormals();return g
}
