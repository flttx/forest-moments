import {BufferGeometry,Float32BufferAttribute} from 'three'
import {creekZ,creekWaterY,creekFalls} from '../game/expansion'
import {terrainHeight} from './terrain'
import {seaLevel,smoothRange} from './worldConfig'

/** Fit the water to the carved banks; the offshore tail dissolves above the ocean. */
export function creekSection(x:number){
 const z=creekZ(x),y=creekWaterY(x)
 const width=(side:number)=>{
  let lo=0,hi=x<creekFalls.footX+.3&&x>creekFalls.pool.x-creekFalls.pool.radius-1?3.2:2.2
  if(terrainHeight(x,z)>=y)return 0
  for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(terrainHeight(x,z+side*mid)<y)lo=mid;else hi=mid}
  return (lo+hi)/2*Math.sqrt(1-smoothRange(x,-10,-8.8))
 }
 // Over the lip the water leaves the bed: the falls sheet (CreekFalls) carries it down to the pool.
 const falling=smoothRange(x,creekFalls.footX-.05,creekFalls.footX+.1)*(1-smoothRange(x,creekFalls.lipX-.12,creekFalls.lipX+.02))
 return {x,y,z,left:width(-1),right:width(1),opacity:smoothRange(y-seaLevel,.025,.24)*(1-smoothRange(x,-9.8,-8.8))*(1-falling)}
}
/** Water leaves the lip with a little forward speed and falls freely; the sheet ends just under the pool surface. */
const lipSpeed=.8,gravity=9.81,fallTime=Math.sqrt(2*(creekFalls.top-creekFalls.pool.water+.05)/gravity)
export const fallsFoot={x:creekFalls.lipX-lipSpeed*fallTime,z:creekZ(creekFalls.lipX-lipSpeed*fallTime)}

/**
 * A curved sheet from the lip down to the pool, a little wider at the foot where it spreads. The middle of the flow is
 * the deepest, so it bows out from the rock; `back` (m) sets a second layer nearer the face, `width` scales it.
 */
export function createFallsGeometry(back=0,width=1){
 const {lipX,top}=creekFalls,lip=creekSection(lipX+.15),half=Math.max(.45,(lip.left+lip.right)/2*.85)*width,mid=lip.z+(lip.right-lip.left)/2
 const rows=24,columns=12,positions:number[]=[],uvs:number[]=[],indices:number[]=[]
 for(let i=0;i<=rows;i++){
  const v=i/rows,t=fallTime*v,y=top+.01-.5*gravity*t*t
  for(let j=0;j<=columns;j++){
   const u=j/columns,across=u*2-1,x=lipX-lipSpeed*t*(1-.25*across*across)-.12*(1-across*across)+back
   const z=mid+(creekZ(x)-creekZ(lipX))+across*half*(1+.35*v)
   positions.push(x,y,z);uvs.push(u,v)
   if(i<rows&&j<columns){const k=i*(columns+1)+j;indices.push(k,k+columns+1,k+1,k+1,k+columns+1,k+columns+2)}
  }
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g
}

export function createCreekGeometry(){
 const positions:number[]=[],uvs:number[]=[],alpha:number[]=[],foam:number[]=[],indices:number[]=[]
 const rows=320,columns=8
 for(let i=0;i<=rows;i++){
  const x=-40+31.2*i/rows,s=creekSection(x)
  // White water where the riffle below the pool steepens.
  const rapids=x<creekFalls.footX?Math.min(1,(creekWaterY(x+.05)-creekWaterY(x-.05))*10*2.6):0
  for(let j=0;j<=columns;j++){
   const t=j/columns,offset=-s.left+(s.left+s.right)*t
   positions.push(x,s.y+.008,s.z+offset);uvs.push((x+40)/3,t);alpha.push(s.opacity);foam.push(rapids)
   if(i<rows&&j<columns){const k=i*(columns+1)+j;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1)}
  }
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uvs,2));g.setAttribute('streamAlpha',new Float32BufferAttribute(alpha,1));g.setAttribute('streamFoam',new Float32BufferAttribute(foam,1));g.setIndex(indices);g.computeVertexNormals();return g
}
