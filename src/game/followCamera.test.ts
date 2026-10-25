import {workshopDoor} from './workshop'
import {expect,it} from 'vitest'
import {createFollowTurn,stepFollowTurn,followTurnConfig,movementYaw,walkingCamera,clipCameraArm,clearCanopy,indoorCameraBoxes} from './followCamera'

it('puts the camera behind all four real movement directions and preserves heading at rest',()=>{
 for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
  const yaw=movementYaw(dx,dz,.4),{eye}=walkingCamera({x:0,y:0,z:0},yaw,false)
  expect(eye.x*dx+eye.z*dz).toBeLessThan(-8)
  expect(movementYaw(0,0,yaw)).toBe(yaw)
 }
})
it('ignores brief direction taps and small steering corrections',()=>{
 let s=createFollowTurn(0)
 for(let i=0;i<8;i++)s=stepFollowTurn(s,Math.PI/2,true,1/60)
 for(let i=0;i<120;i++)s=stepFollowTurn(s,Math.PI/2,false,1/60)
 expect(s.yaw).toBe(0)
 for(let i=0;i<120;i++)s=stepFollowTurn(s,.05,true,1/60)
 expect(s.yaw).toBe(0)
 expect(stepFollowTurn(s,1,true,NaN)).toBe(s);expect(stepFollowTurn(s,1,true,-1)).toBe(s)
})
it('limits reversal speed and acceleration while settling after movement stops',()=>{
 for(const hz of [30,60,144]){
  let s=createFollowTurn(0),previous=s
  for(let i=0;i<hz*4;i++){
   s=stepFollowTurn(s,Math.PI,i<hz*.3,1/hz)
   expect(Math.abs(s.velocity)).toBeLessThanOrEqual(followTurnConfig.maxSpeed+1e-8)
   expect(Math.abs(s.velocity-previous.velocity)*hz).toBeLessThanOrEqual(followTurnConfig.maxAcceleration+1e-7)
   if(i===Math.floor(hz*.35))expect(Math.abs(s.yaw)).toBeLessThan(.25)
   previous=s
  }
  expect(Math.abs(s.yaw-Math.PI)).toBeLessThan(.015)
 }
})
it('takes the short arc across the angle seam and gives consistent frame-rate results',()=>{
 const a=Math.PI-.2,b=-Math.PI+.2,results=[]
 for(const hz of [30,60,144]){
  let s=createFollowTurn(a)
  for(let i=0;i<hz*3;i++)s=stepFollowTurn(s,b,true,1/hz)
  expect(s.yaw).toBeGreaterThan(a);expect(s.yaw-a).toBeLessThan(.401)
  results.push(s.yaw)
 }
 expect(Math.max(...results)-Math.min(...results)).toBeLessThan(.002)
})
it('shortens against a wall without blocking parallel clear arms',()=>{
 const box={minX:1,maxX:2,minY:0,maxY:4,minZ:-1,maxZ:1},target={x:0,y:1,z:0}
 expect(clipCameraArm(target,{x:5,y:2,z:0},[box]).x).toBeLessThan(.82)
 expect(clipCameraArm(target,{x:0,y:2,z:5},[box])).toEqual({x:0,y:2,z:5})
})
it('keeps interior eye within room bounds and lifts near the entrance wall',()=>{
 for(const p of [{x:0,y:0,z:2.5},{x:3.6,y:0,z:1},{x:-3,y:0,z:-1.4}])for(let i=0;i<16;i++){
  const {eye}=walkingCamera(p,i*Math.PI/8,true)
  expect(Math.abs(eye.x)).toBeLessThanOrEqual(3.72);expect(eye.z).toBeGreaterThanOrEqual(-2.72);expect(eye.z).toBeLessThanOrEqual(2.72)
  expect(eye.y).toBeLessThanOrEqual(3.05)
  expect(indoorCameraBoxes.some(b=>eye.x>b.minX&&eye.x<b.maxX&&eye.y>b.minY&&eye.y<b.maxY&&eye.z>b.minZ&&eye.z<b.maxZ)).toBe(false)
 }
 expect(walkingCamera({x:0,y:0,z:2.5},0,true).eye.y).toBe(3.05)
})

it('keeps the outdoor arm in front of the workshop when walking away from its entrance',()=>{
 const {eye}=walkingCamera({...workshopDoor,y:0},Math.PI,false)
 expect(eye.z).toBeGreaterThan(11.21);expect(eye.y).toBe(3.2)
})

it('pulls an eye that sits inside a crown back to the crown surface, leaving crossing or enclosing crowns alone',()=>{
 const target={x:0,y:1,z:0},crown={x:0,y:4,z:8,r:2}
 const inside=clearCanopy(target,{x:0,y:4,z:9},[crown],.5)
 expect(Math.hypot(inside.x-crown.x,inside.y-crown.y,inside.z-crown.z)).toBeCloseTo(2.5,6)
 expect(inside.z).toBeLessThan(9);expect(inside.z).toBeGreaterThan(0)
 // Crown only crosses the middle of the arm: the eye is clear, so nothing moves.
 const beyond={x:0,y:7,z:16};expect(clearCanopy(target,beyond,[crown],.5)).toEqual(beyond)
 // Focus itself under the crown: pulling in cannot help, keep the arm.
 const under={x:0,y:3,z:8.5};expect(clearCanopy({x:0,y:3.5,z:8},under,[crown],.5)).toEqual(under)
 // Leaving one crown into another keeps pulling until both are clear.
 const both=clearCanopy(target,{x:0,y:4,z:9},[crown,{x:0,y:3.5,z:5.5,r:1}],.5)
 expect(Math.hypot(both.x,both.y-3.5,both.z-5.5)).toBeGreaterThanOrEqual(1.5-1e-6)
})
