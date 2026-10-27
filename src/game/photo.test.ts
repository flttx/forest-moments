import {expect,it} from 'vitest'
import {albumLimit,clampOrbitTargets,photoBlock,photoFileName,photosToDrop} from './photo'

const free={mode:'walking' as const,sitting:null,menuPaused:false,aquariumOpen:false,homeTransfer:null,workshopTransfer:null,boatTransfer:null,lookoutTransfer:null}
const seat=(phase:'down'|'idle'|'up')=>({id:'coast' as const,phase,elapsed:0,returnPosition:{x:0,z:0}})

it('allows the camera while walking, rowing, in the tower or settled on a seat',()=>{
 for(const mode of ['walking','rowing','lookout'] as const)expect(photoBlock({...free,mode})).toBeNull()
 expect(photoBlock({...free,mode:'sitting',sitting:seat('idle')})).toBeNull()
})
it('refuses mid-task, mid-movement and under a panel, with the reason',()=>{
 for(const mode of ['fishing','planting','feeding','gathering','crafting','sleeping'] as const)expect(photoBlock({...free,mode})).toBe('busy')
 expect(photoBlock({...free,mode:'sitting',sitting:seat('down')})).toBe('transition')
 expect(photoBlock({...free,mode:'sitting',sitting:seat('up')})).toBe('transition')
 expect(photoBlock({...free,boatTransfer:{direction:'board',elapsed:0,committed:false}})).toBe('transition')
 expect(photoBlock({...free,menuPaused:true})).toBe('menu')
 expect(photoBlock({...free,aquariumOpen:true})).toBe('menu')
})
it('names files by local date and time',()=>{
 expect(photoFileName(new Date(2026,9,27,9,5,3))).toBe('forest-moments-20261027-090503.png')
})
it('keeps only the newest twelve photos',()=>{
 const records=Array.from({length:15},(_,i)=>({id:`p${i}`,at:new Date(2026,9,27,10,i).toISOString()}))
 const drop=photosToDrop([...records].reverse())
 expect(albumLimit).toBe(12);expect(drop.sort()).toEqual(['p0','p1','p2'])
 expect(photosToDrop(records.slice(0,12))).toEqual([])
})
it('pulls orbit targets back inside play limits',()=>{
 const o={targetPitch:-.1,targetZoom:.12};clampOrbitTargets(o,[.17,1.13],[.55,14])
 expect(o).toEqual({targetPitch:.17,targetZoom:.55})
 const p={targetPitch:1.4,targetZoom:2};clampOrbitTargets(p,[.17,1.13],[.55,14]);expect(p).toEqual({targetPitch:1.13,targetZoom:2})
})
