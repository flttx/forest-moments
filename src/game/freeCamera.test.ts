import {expect,it} from 'vitest'
import {constrainFreePosition,dollyFreeView,freeRadius,lookDirection,moveFreeView,turnFreeView,viewFromDirection,type FreeSpace} from './freeCamera'

const flat:FreeSpace={boxes:[],crowns:[],floor:()=>0}
const raccoon={x:0,y:0,z:0}
const view=(yaw=0,pitch=0)=>({x:0,y:2,z:0,yaw,pitch})

it('reads and writes a view direction consistently',()=>{
 const v=viewFromDirection({x:1,y:2,z:3},{x:1,y:1,z:1})
 const d=lookDirection(v),length=Math.hypot(1,1,1)
 expect([d.x,d.y,d.z].map(n=>+n.toFixed(6))).toEqual([1,1,1].map(n=>+(n/length).toFixed(6)))
})
it('moves along the heading and strafes to the right of it',()=>{
 const ahead=moveFreeView(view(0),{forward:1,right:0,up:0},2),side=moveFreeView(view(0),{forward:0,right:1,up:0},2)
 expect([ahead.x,ahead.z]).toEqual([0,2])
 expect(side.x).toBeCloseTo(-2);expect(side.z).toBeCloseTo(0)
 // Diagonals are not faster.
 const diagonal=moveFreeView(view(0),{forward:1,right:1,up:0},2)
 expect(Math.hypot(diagonal.x,diagonal.z)).toBeCloseTo(2)
 expect(moveFreeView(view(),{forward:0,right:0,up:1},1).y).toBe(3)
 expect(dollyFreeView(view(0,0),3).z).toBeCloseTo(3)
})
it('turns with the drag and keeps pitch from flipping over',()=>{
 expect(turnFreeView(view(),100,0).yaw).toBeLessThan(0)
 expect(turnFreeView(view(),0,100000).pitch).toBeGreaterThan(-1.46)
 expect(turnFreeView(view(),0,-100000).pitch).toBeLessThan(1.46)
 expect(turnFreeView(view(),Number.NaN,0)).toEqual(view())
})
it('keeps the camera within the radius of the raccoon',()=>{
 const p=constrainFreePosition({x:40,y:2,z:0},raccoon,flat)
 expect(Math.hypot(p.x,p.y,p.z)).toBeCloseTo(freeRadius)
 expect(constrainFreePosition({x:3,y:2,z:1},raccoon,flat)).toEqual({x:3,y:2,z:1})
})
it('stays above the ground and under a ceiling indoors',()=>{
 const hill:FreeSpace={...flat,floor:x=>x>5?4:0}
 expect(constrainFreePosition({x:8,y:1,z:0},{x:5,y:4,z:0},hill).y).toBeCloseTo(4.3)
 const room:FreeSpace={...flat,room:{x:3.7,z:2.7,ceiling:3}}
 expect(constrainFreePosition({x:9,y:8,z:-9},raccoon,room)).toEqual({x:3.7,y:3,z:-2.7})
})
it('is pushed out of a building through the nearest face, and out of a crown',()=>{
 const wall={minX:5,maxX:9,minY:0,maxY:6,minZ:-2,maxZ:2}
 const out=constrainFreePosition({x:5.4,y:3,z:0},raccoon,{...flat,boxes:[wall]})
 expect(out.x).toBeCloseTo(5-.3);expect(out.y).toBe(3)
 const crown=constrainFreePosition({x:0,y:5,z:6.5},raccoon,{...flat,crowns:[{x:0,y:5,z:8,r:2}]})
 expect(Math.hypot(crown.x,crown.y-5,crown.z-8)).toBeCloseTo(2.3)
 // A raccoon standing inside the crown or building does not trap the camera.
 const same=constrainFreePosition({x:0,y:1,z:1},raccoon,{...flat,crowns:[{x:0,y:1,z:0,r:3}]})
 expect(same).toEqual({x:0,y:1,z:1})
})
