import {expect,it} from 'vitest'
import {createCreekGeometry,creekSection} from './creekGeometry'
import {terrainHeight} from './terrain'
import {seaLevel} from './worldConfig'
import {bridge,bridgeHeight} from '../game/expansion'

it('keeps the visible channel inside its banks and below the bridge deck',()=>{
 for(let x=-36;x<=-10;x+=.2){
  const s=creekSection(x)
  expect(terrainHeight(x,s.z)).toBeLessThan(s.y)
  for(const [side,width] of [[-1,s.left],[1,s.right]]){
   expect(width).toBeGreaterThan(0);expect(width).toBeLessThanOrEqual(2.2)
   if(width<2.19)expect(Math.abs(terrainHeight(x,s.z+side*width)-s.y)).toBeLessThan(.001)
  }
 }
 expect(bridgeHeight(bridge.z)-creekSection(bridge.x).y).toBeGreaterThan(1)
 expect(creekSection(-40).opacity).toBe(0)
 expect(creekSection(-8.8)).toMatchObject({left:0,right:0,opacity:0})
})

it('has no opaque coplanar ocean tail or invalid geometry at the source cap',()=>{
 const g=createCreekGeometry()
 try{
  const p=g.getAttribute('position'),a=g.getAttribute('streamAlpha'),normal=g.getAttribute('normal')
  for(let i=0;i<p.count;i++){
   expect([p.getX(i),p.getY(i),p.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i)].every(Number.isFinite)).toBe(true)
   if(p.getY(i)<=seaLevel+.033)expect(a.getX(i)).toBe(0)
  }
 }finally{g.dispose()}
})
