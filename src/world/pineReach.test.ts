import {expect,it} from 'vitest'
import {pineReach} from './pineReach'

const around=(scale:number,yaw:number,low:number,high:number,n=16)=>Array.from({length:n},(_,i)=>pineReach(scale,yaw,i*Math.PI*2/n,low,high))

it('reaches far only where a low branch actually is, and little between branches',()=>{
 const reaches=around(1,0,.15,1.1)
 expect(Math.max(...reaches)).toBeGreaterThan(1.3)
 expect(Math.min(...reaches)).toBeLessThan(.7)
 // Several directions at body height are gaps, which the old round collider blocked out to 1.5 m.
 expect(reaches.filter(r=>r<.7).length).toBeGreaterThanOrEqual(3)
})
it('has no foliage below the lowest whorl',()=>{
 for(const r of around(1,.4,0,.5))expect(r).toBeLessThan(.6)
})
it('turns with the tree and grows with its scale',()=>{
 for(const a of [0,1,2.5,4]){
  expect(pineReach(1,.7,a,.15,1.1)).toBeCloseTo(pineReach(1,0,a+.7,.15,1.1),6)
 }
 expect(Math.max(...around(1.18,0,.15,1.1))).toBeGreaterThan(Math.max(...around(.85,0,.15,1.1)))
})
it('reaches further where the ground rises to meet the foliage',()=>{
 const flat=Math.max(...around(1,0,.15,1.1)),uphill=Math.max(...around(1,0,.65,1.6))
 expect(uphill).toBeGreaterThanOrEqual(flat-.3)
 expect(Math.max(...around(1,0,1.8,2.7))).toBeGreaterThan(1.5)
})
