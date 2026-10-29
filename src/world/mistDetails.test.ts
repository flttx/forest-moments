import {expect,it} from 'vitest'
import {mistLogs,mistLogHalf} from './mistDetails'
import {canStandAt,moveOnGround,standBlocker} from '../game/movement'
import {mistPaths} from './mistIsland'
import {mistEdgePlants} from './vegetationLayout'

it('blocks the visible log body and hollow ends but leaves a walkable route around each log',()=>{
 for(const p of mistLogs){
  const point=(x:number,z:number)=>({x:p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,z:p.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z})
  expect(standBlocker(p.x,p.z)).toBe('hollow log')
  for(const side of [-1,1]){
   const end=point(side*mistLogHalf.x*p.scale,0)
   expect(standBlocker(end.x,end.z)).toBe('hollow log')
   let position=point(0,side*(mistLogHalf.z*p.scale+.7))
   for(let i=0;i<40;i++)position=moveOnGround(position,-Math.sin(p.yaw)*side*.1,-Math.cos(p.yaw)*side*.1)
   const localZ=Math.sin(p.yaw)*(position.x-p.x)+Math.cos(p.yaw)*(position.z-p.z)
   expect(localZ*side).toBeGreaterThan(mistLogHalf.z*p.scale+.25)
  }
  const hx=mistLogHalf.x*p.scale+.45,hz=mistLogHalf.z*p.scale+.45
  const corners=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz],[-hx,-hz]]
  for(let edge=0;edge<4;edge++)for(let i=0;i<=20;i++){
   const a=corners[edge],b=corners[edge+1],q=point(a[0]+(b[0]-a[0])*i/20,a[1]+(b[1]-a[1])*i/20)
   expect(canStandAt(q.x,q.z),JSON.stringify({...q,blocker:standBlocker(q.x,q.z)})).toBe(true)
  }
 }
})

it('keeps the full trail width open after adding edge shrubs',()=>{
 expect(mistEdgePlants.length).toBeGreaterThan(0)
 for(const [ax,az,bx,bz] of mistPaths){
  if(ax<95)continue // The narrower reused jetty approach has its own two-way route check.
  const length=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/length,nz=(bx-ax)/length
  for(let t=0;t<=1;t+=.05)for(const side of [-.6,0,.6]){
   const x=ax+(bx-ax)*t+nx*side,z=az+(bz-az)*t+nz*side
   expect(canStandAt(x,z),`${x},${z}`).toBe(true)
  }
 }
})
