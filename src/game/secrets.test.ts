import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {bottleSpot,constellation,decodeSecrets,discover,emptySecrets,jellyfishSpot,secretsStorageKey} from './secrets'
import {canStandAt} from './movement'
import {onSand} from './forage'
import {seaLevel} from '../world/worldConfig'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
it('places the bottle on standable sand, the jellyfish at the water line, the stars high in the sky',()=>{
 expect(canStandAt(bottleSpot.x,bottleSpot.z)).toBe(true);expect(onSand(bottleSpot.x,bottleSpot.z)).toBe(true)
 expect(jellyfishSpot.y).toBeLessThan(seaLevel)
 for(const d of constellation.stars){expect(Math.hypot(...d)).toBeCloseTo(1);expect(d[1]).toBeGreaterThan(.6)}
})
it('records the first finding only and reads saves strictly',()=>{
 const a=discover(emptySecrets(),'bottle','2026-10-27T01:00:00Z')
 expect(discover(a,'bottle','2026-10-28T01:00:00Z')).toBe(a)
 expect(decodeSecrets(JSON.stringify(a))).toEqual(a)
 for(const raw of ['x','{}',JSON.stringify({version:1,found:{shark:'2026-10-27T01:00:00Z'}}),JSON.stringify({version:1,found:{bottle:'soon'}})])expect(decodeSecrets(raw)).toBeNull()
})
it('F at the bottle finds it, saves it and counts for the journal',async()=>{
 const {useForestStore:s}=await import('./store'),{useJournalStore:j}=await import('./journalStore'),{installJournal}=await import('./journalStore')
 const stop=installJournal()
 j.setState(x=>({book:{...x.book,page:{...x.book.page,tasks:[{id:'secret',progress:0,doneAt:null},{id:'catch',progress:0,doneAt:null},{id:'feed',progress:0,doneAt:null}]}}}))
 s.setState({location:'island',mode:'walking',nearby:null,position:{x:bottleSpot.x+.3,z:bottleSpot.z}})
 s.getState().interact()
 expect(s.getState().secretsBook.found.bottle).toBeTruthy();expect(JSON.parse(memory.get(secretsStorageKey)!).found.bottle).toBeTruthy()
 expect(j.getState().book.page.tasks[0].doneAt).not.toBeNull()
 // Reading it again only shows the note.
 s.getState().interact();expect(Object.keys(s.getState().secretsBook.found)).toEqual(['bottle'])
 stop()
})
