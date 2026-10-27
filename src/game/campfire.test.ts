import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {beginRoast,canStargaze,roastBlock,roastSeconds,roastable} from './campfire'
import {catchId,type SeatSession} from './expansion'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())
const seat=(id:SeatSession['id'],phase:SeatSession['phase']='idle'):SeatSession=>({id,phase,elapsed:0,returnPosition:{x:0,z:0}})
const fish={sizeCm:26,at:'2026-10-27T01:00:00Z',species:'goldKoi' as const},older={sizeCm:20,at:'2026-10-26T01:00:00Z'}
const base={mode:'sitting' as const,sitting:seat('camp-west'),homeBook:{version:1 as const,fish:[],usedCatchIds:[],nights:0,fireLit:true},fishBook:{count:2,bestCm:26,recent:[fish,older],kinds:{}},timeOfDay:'day' as const,menuPaused:false}

it('roasts only seated by a lit fire with a fish on hand, newest first',()=>{
 expect(roastBlock(base)).toBeNull()
 expect(beginRoast(base)).toEqual({catchId:catchId(fish),species:'goldKoi',sizeCm:26,elapsed:0})
 expect(roastBlock({...base,homeBook:{...base.homeBook,fireLit:false}})).toBe('fire')
 expect(roastBlock({...base,sitting:seat('coast')})).toBe('seat')
 expect(roastBlock({...base,sitting:seat('camp-west','down')})).toBe('seat')
 // Kept, released or roasted catches are no longer on hand.
 const used={...base,homeBook:{...base.homeBook,usedCatchIds:[catchId(fish),catchId(older)]}}
 expect(roastable(used)).toEqual([]);expect(roastBlock(used)).toBe('fish')
 expect(beginRoast({...base,homeBook:{...base.homeBook,usedCatchIds:[catchId(fish)]}})?.species).toBe('koi')
})
it('looks up at the stars only at night, settled on a camp or sea seat',()=>{
 expect(canStargaze({...base,timeOfDay:'night'})).toBe(true)
 expect(canStargaze({...base,timeOfDay:'night',sitting:seat('reef')})).toBe(true)
 expect(canStargaze(base)).toBe(false)
 expect(canStargaze({...base,timeOfDay:'night',sitting:seat('stool')})).toBe(false)
})
it('a roast finishes after a while seated, uses up the fish and fills the satchel; standing up stops it with no loss',async()=>{
 const {useForestStore:s}=await import('./store'),{useInventoryStore:i,installInventory}=await import('./inventoryStore')
 const stop=installInventory()
 s.setState({...base})
 s.getState().startRoast();expect(s.getState().roast?.species).toBe('goldKoi')
 for(let k=0;k<roastSeconds/.05-2;k++)s.getState().tickHome(.05)
 expect(s.getState().roast).not.toBeNull()
 for(let k=0;k<4;k++)s.getState().tickHome(.05)
 expect(s.getState().roast).toBeNull();expect(s.getState().roasted).toBe(1)
 expect(s.getState().homeBook.usedCatchIds).toContain(catchId(fish));expect(i.getState().inv.items.roastFish).toBe(1)
 // The next one is the older fish; standing up mid-way keeps it on hand.
 s.getState().startRoast();s.getState().tickHome(1);s.getState().leaveSeat()
 expect(s.getState().roast).toBeNull();expect(s.getState().homeBook.usedCatchIds).not.toContain(catchId(older))
 // Stargazing toggles at night and ends on standing up.
 s.setState({...base,timeOfDay:'night',roast:null});s.getState().toggleStargaze();expect(s.getState().stargazing).toBe(true)
 s.getState().leaveSeat();expect(s.getState().stargazing).toBe(false)
 stop()
})
