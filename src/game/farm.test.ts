import {describe,it,expect} from 'vitest'
import {createAnimals,decodeFarm,farmSpotFree,mealTargets,stepAnimal} from './farm'

describe('farm feeding',()=>{
 it('consumes food only after physically arriving; both animated actors can finish',()=>{
  const animals=createAnimals()
  for(let i=0;i<2000;i++)for(let j=0;j<animals.length;j++){
   animals[j]=stepAnimal(animals[j],.05,true,{x:8,z:4.2})
   const a=animals[j];expect(farmSpotFree(a.x,a.z,a.id==='sheep'?.28:.14)).toBe(true)
   if(a.eaten>0)expect(Math.hypot(a.x-mealTargets[a.id].x,a.z-mealTargets[a.id].z)).toBeLessThan(.025)
  }
  expect(animals.map(a=>a.eaten)).toEqual([5,5])
 })
 it('yields to the player and does not credit a blocked approach',()=>{
  let a=createAnimals()[0];const player={x:a.x+.05,z:a.z}
  for(let i=0;i<300;i++)a=stepAnimal(a,.05,true,player)
  expect(a.eaten).toBe(0);expect(a.state).toBe('idle');expect(a.x).toBe(7.1)
 })
 it('walks safe idle routes repeatedly without consuming a meal',()=>{
  for(let a of createAnimals()){
   const start={...a};let distance=0
   for(let i=0;i<4000;i++){const next=stepAnimal(a,.05,false,{x:0,z:0});distance+=Math.hypot(next.x-a.x,next.z-a.z);a=next;expect(farmSpotFree(a.x,a.z,a.id==='sheep'?.28:.14)).toBe(true)}
   expect(distance).toBeGreaterThan(15);expect(a.eaten).toBe(start.eaten)
  }
 })
 it('rejects malformed, negative and fractional saved counts',()=>{
  for(const raw of ['null','bad','{"version":1,"meals":-1}','{"version":1,"meals":1.5}','{"version":2,"meals":3}'])expect(decodeFarm(raw).meals).toBe(0)
  expect(decodeFarm('{"version":1,"meals":3}').meals).toBe(3)
 })
})
