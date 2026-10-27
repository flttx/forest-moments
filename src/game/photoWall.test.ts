import {expect,it} from 'vitest'
import {decodeWall,hang,keepExisting,takeDown,wallSlots} from './photoWall'

it('hangs up to six photos once each, in order, and takes them down',()=>{
 let wall:readonly string[]=[]
 for(let i=0;i<8;i++)wall=hang(wall,`p${i}`)
 expect(wall).toEqual(['p0','p1','p2','p3','p4','p5']);expect(wall).toHaveLength(wallSlots)
 expect(hang(wall,'p9')).toBe(wall)
 expect(hang(['a'],'a')).toEqual(['a'])
 wall=takeDown(wall,'p2');expect(wall).toEqual(['p0','p1','p3','p4','p5'])
 expect(takeDown(wall,'zz')).toBe(wall)
})
it('forgets frames whose photo left the album',()=>{
 const wall=['a','b','c']
 expect(keepExisting(wall,['a','b','c','d'])).toBe(wall)
 expect(keepExisting(wall,['c','a'])).toEqual(['a','c'])
})
it('reads a saved wall, dropping junk and duplicates',()=>{
 expect(decodeWall(JSON.stringify(['a','a','b',3,'']))).toEqual(['a','b'])
 expect(decodeWall('broken')).toEqual([]);expect(decodeWall(null)).toEqual([]);expect(decodeWall('{}')).toEqual([])
 expect(decodeWall(JSON.stringify(Array.from({length:9},(_,i)=>`p${i}`)))).toHaveLength(6)
})
