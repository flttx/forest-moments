import {expect,it} from 'vitest'
import {createCreekGeometry,creekSection,fallsFoot} from './creekGeometry'
import {terrainHeight} from './terrain'
import {seaLevel} from './worldConfig'
import {bridge,bridgeHeight,creekFalls,creekWaterY,creekZ,creekPoolDistance} from '../game/expansion'
it('keeps the visible channel inside its banks and below the bridge deck',()=>{
 for(let x=-36;x<=-10;x+=.2){
  const s=creekSection(x),limit=x<creekFalls.footX+.3&&x>creekFalls.pool.x-creekFalls.pool.radius-1?3.2:2.2
  expect(terrainHeight(x,s.z)).toBeLessThan(s.y)
  for(const [side,width] of [[-1,s.left],[1,s.right]]){
   expect(width).toBeGreaterThan(0);expect(width).toBeLessThanOrEqual(limit)
   if(width<limit-.01)expect(Math.abs(terrainHeight(x,s.z+side*width)-s.y)).toBeLessThan(.001)
  }
 }
 expect(bridgeHeight(bridge.z)-creekSection(bridge.x).y).toBeGreaterThan(1)
 expect(creekSection(-40).opacity).toBe(0)
 expect(creekSection(-8.8)).toMatchObject({left:0,right:0,opacity:0})
})

it('drops over a real rock lip into a walled plunge pool, then runs out to the sea',()=>{
 const {lipX,footX,top,pool}=creekFalls
 // A vertical step, not a slide: over 3 m of fall inside one metre of run.
 expect(creekWaterY(lipX)-creekWaterY(footX)).toBeGreaterThan(3)
 expect(lipX-footX).toBeLessThan(1)
 expect(creekWaterY(lipX+2)-top).toBeLessThan(.05)
 // The upper creek idles: no stretch above the lip steeper than 1:10.
 for(let x=lipX+.1;x<-10;x+=.25)expect(creekWaterY(x+.25)-creekWaterY(x)).toBeLessThan(.025)
 // The pool holds water: banks all round stand above its surface except the outlet, and its bed is below it.
 expect(terrainHeight(pool.x,pool.z)).toBeLessThan(pool.water-.3)
 for(let i=0;i<32;i++){
  const a=i*Math.PI/16,x=pool.x+Math.cos(a)*(pool.radius+1),z=pool.z+Math.sin(a)*(pool.radius+1)
  if(Math.cos(a)<-.7)continue
  expect(terrainHeight(x,z),`rim ${a.toFixed(2)}`).toBeGreaterThan(pool.water)
 }
 // The outlet reaches the sea, and the sheet sits over water from lip to pool.
 expect(creekWaterY(-39)).toBeCloseTo(seaLevel,6)
 for(let v=0;v<=1;v+=.1){const x=lipX+(fallsFoot.x-lipX)*v;expect(terrainHeight(x,creekZ(x))).toBeLessThan(top)}
 expect(fallsFoot.x).toBeLessThan(footX)
 expect(creekPoolDistance(fallsFoot.x,fallsFoot.z)).toBeLessThan(pool.radius)
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
