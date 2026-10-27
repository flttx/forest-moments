import {afterEach,expect,it,vi} from 'vitest'
import {afterMeal,brushSpot,decodeFarm,eggReady,eggSpot,woolReady} from './farm'
import {canStandAt} from './movement'

afterEach(()=>vi.unstubAllGlobals())
it('owes an egg the morning after a meal, and keeps one waiting when fed again',()=>{
 let b=afterMeal({version:1,meals:0},2)
 expect(b).toMatchObject({meals:1,fedDay:2,eggDay:3})
 expect(eggReady(b,2)).toBe(false);expect(eggReady(b,3)).toBe(true)
 // Fed again on day 3 before collecting: the waiting egg stays.
 b=afterMeal(b,3);expect(b.eggDay).toBe(3);expect(eggReady(b,3)).toBe(true)
 // Collected (eggDay null), then fed again: the next is owed for tomorrow.
 b=afterMeal({...b,eggDay:null},3);expect(b.eggDay).toBe(4)
})
it('lets the sheep be brushed once on a day it was fed',()=>{
 const fed=afterMeal({version:1,meals:0},5)
 expect(woolReady(fed,5)).toBe(true);expect(woolReady(fed,6)).toBe(false)
 expect(woolReady({...fed,woolDay:5},5)).toBe(false)
})
it('reads old meal-only saves and the new fields',()=>{
 expect(decodeFarm(JSON.stringify({version:1,meals:4}))).toEqual({version:1,meals:4})
 expect(decodeFarm(JSON.stringify({version:1,meals:4,fedDay:2,eggDay:null,woolDay:2}))).toEqual({version:1,meals:4,fedDay:2,eggDay:null,woolDay:2})
 expect(decodeFarm(JSON.stringify({version:1,meals:4,fedDay:-1,eggDay:'x'}))).toEqual({version:1,meals:4})
})
it('the egg and brushing spots are inside the pen where the raccoon can stand',()=>{
 expect(canStandAt(eggSpot.x,eggSpot.z)).toBe(true);expect(canStandAt(brushSpot.x,brushSpot.z)).toBe(true)
})
it('in play: F at the coop collects the egg into the satchel; F by the sheep brushes it once',async()=>{
 const memory=new Map<string,string>()
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
 vi.resetModules()
 const {useForestStore:s}=await import('./store'),{useInventoryStore:i,installInventory}=await import('./inventoryStore')
 const stop=installInventory(),nights=s.getState().homeBook.nights
 s.setState({location:'island',mode:'walking',nearby:'farm',farmReady:true,mealActive:false,farmBook:{version:1,meals:1,fedDay:nights,eggDay:nights,woolDay:undefined},position:{...eggSpot}})
 s.getState().interact();expect(s.getState().foraging?.source).toBe('egg')
 for(let k=0;k<30;k++)s.getState().tickForage(.05)
 expect(i.getState().inv.items.egg).toBe(1);expect(s.getState().farmBook.eggDay).toBeNull()
 s.setState({position:{...brushSpot}});s.getState().interact();expect(s.getState().foraging?.source).toBe('wool')
 for(let k=0;k<50;k++)s.getState().tickForage(.05)
 expect(i.getState().inv.items.wool).toBe(1);expect(s.getState().farmBook.woolDay).toBe(nights)
 s.getState().interact();expect(s.getState().foraging).toBeNull()
 stop()
})
