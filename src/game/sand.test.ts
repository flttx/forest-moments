import {expect,it} from 'vitest'
import {decodeSand,maxWorks,pawDepth,placementRefusal,raccoonOutline,riverPath,sandObstacles,sandOffsetAt,sandRect,sandSize,stepStride,tidelineDistance,workHeight,type SandWork} from './sand'
import {terrainHeight} from '../world/terrain'
import {seaLevel} from '../world/worldConfig'

const castle:SandWork={kind:'castle',x:-4,z:30,yaw:0}
it('sizes the sand texture to whole 3 cm texels on the terrain grid',()=>{
 expect(sandSize).toEqual({w:940,h:540})
 for(const v of [sandRect.minX,sandRect.maxX,sandRect.minZ,sandRect.maxZ])expect(Math.abs((v+48)/.3-Math.round((v+48)/.3))).toBeLessThan(1e-9)
})
it('accepts open sand and refuses trees and rocks, the sea, the edge, overlaps and a full beach',()=>{
 expect(placementRefusal(castle,[])).toBeNull()
 expect(placementRefusal({...castle,x:-7,z:25.8},[])).toBe('blocked')
 expect(placementRefusal({...castle,x:6,z:37.4},[])).toBe('water')
 expect(placementRefusal({...castle,x:-13.6},[])).toBe('outside')
 expect(placementRefusal({...castle,x:-3.5},[castle])).toBe('overlap')
 expect(placementRefusal({kind:'pit',x:4,z:30,yaw:0},Array(maxWorks).fill(castle))).toBe('full')
 expect(placementRefusal({kind:'river',x:1,z:33,yaw:0},[])).toBeNull()
 expect(placementRefusal({kind:'river',x:1,z:26,yaw:0},[])).toBe('far')
})
it('runs a river from the dug end straight out into the sea',()=>{
 const path=riverPath({x:1,z:33})
 expect(path[0]).toEqual({x:1,z:33})
 expect(terrainHeight(path.at(-1)!.x,path.at(-1)!.z)).toBeLessThan(seaLevel+.05)
 expect(path.at(-1)!.z).toBeGreaterThan(37)
 expect(tidelineDistance({x:1,z:33})).toBeGreaterThan(4);expect(tidelineDistance({x:1,z:33})).toBeLessThan(5.5)
})
it('digs pits and channels down, raises castle mounds and grows each with its build amount',()=>{
 const pit:SandWork={kind:'pit',x:4,z:30,yaw:0}
 expect(workHeight(pit,4,30)).toBeCloseTo(-.32)
 expect(workHeight(pit,4.7,30)).toBeGreaterThan(0)
 expect(workHeight(pit,4,30,.5)).toBeCloseTo(-.16)
 expect(workHeight(castle,-4,30)).toBeCloseTo(.07)
 const river:SandWork={kind:'river',x:1,z:33,yaw:0},mid=riverPath(river)[6]
 expect(workHeight(river,mid.x,mid.z)).toBeLessThan(-.1)
 expect(workHeight(river,mid.x,mid.z,.2)).toBeCloseTo(0)
 expect(sandOffsetAt([pit],4,30)).toBeCloseTo(-.32)
 expect(sandOffsetAt([pit],4,10)).toBe(0)
 expect(sandObstacles([pit,castle])).toEqual([{x:-4,z:30,r:.72}])
})
it('presses a raccoon outline: head, ears, body and ringed tail inside, the gaps outside',()=>{
 for(const [u,v] of [[0,.36],[.11,.48],[0,0],[.3,.28],[.2,-.68]])expect(raccoonOutline(u,v)).toBeLessThan(0)
 for(const [u,v] of [[0,.7],[.3,0],[-.3,-.7]])expect(raccoonOutline(u,v)).toBeGreaterThan(0)
 const print:SandWork={kind:'imprint',x:4,z:30,yaw:0}
 expect(workHeight(print,4,30)).toBeLessThan(-.03)
 const depths=Array.from({length:12},(_,i)=>workHeight(print,4+.08+i*.0001,30+.5+i*.02))
 expect(new Set(depths.map(d=>d.toFixed(3))).size).toBeGreaterThan(1)
})
it('keeps today’s works and smooths the beach on another day or a broken save',()=>{
 const book={version:1,day:3,works:[castle,{kind:'pit',x:4,z:30,yaw:0}]}
 expect(decodeSand(JSON.stringify(book),3).works).toHaveLength(2)
 expect(decodeSand(JSON.stringify(book),4).works).toEqual([])
 expect(decodeSand('{bad',3)).toEqual({version:1,day:3,works:[]})
 expect(decodeSand(JSON.stringify({...book,works:[{kind:'tower',x:0,z:30,yaw:0},{...castle,x:NaN},{...castle,x:30}]}),3).works).toEqual([])
})
it('alternates paw prints a stride apart, longer when running, and ignores standing still',()=>{
 let s={travelled:0,left:true},prints=0,from={x:0,z:30}
 for(let i=1;i<=100;i++){const to={x:0,z:30+i*.01},r=stepStride(s,from,to,false);s=r.stride;if(r.print)prints++;from=to}
 // One metre at a 20 cm stride; float steps may leave the last one a hair short.
 expect(prints).toBeGreaterThanOrEqual(4);expect(prints).toBeLessThanOrEqual(5)
 expect(stepStride(s,from,from,false).print).toBeNull()
 const run=stepStride({travelled:.3,left:true},{x:0,z:0},{x:0,z:.1},true)
 expect(run.print!.left).toBe(true);expect(run.stride.left).toBe(false)
 expect(pawDepth(0,0,true)).toBeGreaterThan(.01);expect(pawDepth(.2,0,true)).toBe(0)
})
