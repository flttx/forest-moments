import {beforeEach,afterEach,expect,it,vi} from 'vitest'
import {soundCues} from './soundCues'
import {beginFishing} from '../game/fishing'
import {catchId} from '../game/expansion'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
const names=(cues:{name:string}[])=>cues.map(c=>c.name)

it('voices each fishing step once, and nothing when the state did not change',async()=>{
 const {useForestStore:s}=await import('../game/store'),base=s.getState()
 expect(soundCues(base,base)).toEqual([])
 const cast={...base,mode:'fishing' as const,fishing:beginFishing(()=>.5)}
 expect(names(soundCues(base,cast))).toEqual(['cast'])
 const waiting={...cast,fishing:{...cast.fishing,phase:'waiting' as const}},bite={...cast,fishing:{...cast.fishing,phase:'bite' as const}}
 expect(names(soundCues(cast,waiting))).toEqual(['splash-tiny'])
 expect(names(soundCues(waiting,bite))).toEqual(['bite'])
 expect(names(soundCues(bite,{...cast,fishing:{...cast.fishing,phase:'reeling' as const}}))).toEqual(['splash'])
 // Ticking the same phase forward is silent.
 expect(soundCues(waiting,{...waiting,fishing:{...waiting.fishing,elapsed:1}})).toEqual([])
})
it('tells a kept catch from one let go, and opens then closes doors',async()=>{
 const {useForestStore:s}=await import('../game/store'),base=s.getState(),fish={at:'2026-10-26T01:00:00Z',sizeCm:30}
 const caught={...base,fishBook:{count:1,bestCm:30,recent:[fish],kinds:{}}}
 const kept={...caught,homeBook:{...caught.homeBook,fish:[{...fish,id:catchId(fish)}],usedCatchIds:[catchId(fish)]}}
 expect(names(soundCues(caught,kept))).toEqual(['pour'])
 const released={...caught,homeBook:{...caught.homeBook,usedCatchIds:[catchId(fish)]}}
 expect(names(soundCues(caught,released))).toEqual(['splash'])
 const opening={...base,workshopTransfer:{direction:'enter' as const,elapsed:0,committed:false}}
 expect(names(soundCues(base,opening))).toEqual(['door-open'])
 expect(names(soundCues(opening,{...opening,workshopTransfer:{...opening.workshopTransfer,elapsed:.5,committed:true}}))).toEqual(['door-close'])
})
it('marks plane strokes, misses, the finished stool and the campfire',async()=>{
 const {useForestStore:s}=await import('../game/store'),base=s.getState()
 const crafting={...base,mode:'crafting' as const,workshopBook:{version:1 as const,phase:'carrying' as const},craft:{elapsed:.6,steps:0,stroke:0,feedback:'first' as const}}
 expect(names(soundCues(crafting,{...crafting,craft:{...crafting.craft,steps:1,stroke:.95,feedback:'good' as const}}))).toEqual(['craft'])
 expect(names(soundCues(crafting,{...crafting,craft:{...crafting.craft,feedback:'miss' as const}}))).toEqual(['drop'])
 expect(soundCues(crafting,{...crafting,craft:{...crafting.craft,elapsed:.7}})).toEqual([])
 expect(names(soundCues(crafting,{...crafting,workshopBook:{version:1,phase:'finished'}}))).toContain('task-done')
 expect(names(soundCues(base,{...base,homeBook:{...base.homeBook,fireLit:true}}))).toEqual(['rustle'])
})
