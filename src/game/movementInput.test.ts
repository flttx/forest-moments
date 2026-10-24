import {expect,it} from 'vitest'
import {cameraRelativeMovement as move} from './movementInput'

it('maps all four keys to the orbit basis at sixteen headings',()=>{
 for(let i=0;i<16;i++){
  const yaw=i*Math.PI/8,f={x:-Math.sin(yaw),z:-Math.cos(yaw)},r={x:Math.cos(yaw),z:-Math.sin(yaw)}
  for(const [x,z,expected,sign] of [[0,-1,f,1],[0,1,f,-1],[1,0,r,1],[-1,0,r,-1]] as const){
   const result=move(x,z,yaw)!
   expect(result.x).toBeCloseTo(expected.x*sign,8);expect(result.z).toBeCloseTo(expected.z*sign,8)
  }
 }
})
it('redirects held W with the changing camera without needing a key release',()=>{
 expect(move(0,-1,0)).toMatchObject({x:0,z:-1})
 expect(move(0,-1,Math.PI/2)!.x).toBeCloseTo(-1)
 expect(move(0,-1,Math.PI/2)!.z).toBeCloseTo(0)
})
it('A/D followed by W uses the independent camera basis, never the character turn',()=>{
 for(const yaw of [0,.7,-2.9])for(const side of [-1,1]){
  const lateral=move(side,0,yaw)!,forward=move(0,-1,yaw)!
  expect(lateral.x*forward.x+lateral.z*forward.z).toBeCloseTo(0)
  expect(move(0,-1,yaw)).toEqual(forward)
 }
})
it('diagonal input has unit speed and releasing side input restores camera forward',()=>{
 for(const side of [-1,1]){
  const diagonal=move(side,-1,.5)!,forward=move(0,-1,.5)!
  expect(Math.hypot(diagonal.x,diagonal.z)).toBeCloseTo(1)
  expect(diagonal.x*forward.x+diagonal.z*forward.z).toBeCloseTo(Math.SQRT1_2)
 }
})
it('rejects no input and invalid input',()=>{
 expect(move(0,0,1)).toBeNull();expect(move(NaN,1,0)).toBeNull();expect(move(0,-1,Infinity)).toBeNull()
})
