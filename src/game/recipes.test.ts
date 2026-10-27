import {afterEach,expect,it,vi} from 'vitest'
import {recipeBlock,recipes,woodReady} from './recipes'
import {decodeWorkshop,workshopAction,craftSpot,stoolSeat} from './workshop'

afterEach(()=>vi.unstubAllGlobals())
const done={version:1 as const,phase:'finished' as const}
it('needs the stool first, the materials, and makes each piece once',()=>{
 expect(recipeBlock({version:1,phase:'carrying'},{wood:9},'table')).toBe('stool')
 expect(recipeBlock(done,{wood:2},'table')).toBe('materials')
 expect(recipeBlock(done,{wood:3},'table')).toBeNull()
 expect(recipeBlock({...done,made:['table']},{wood:3},'table')).toBe('made')
 expect(recipeBlock(done,{wood:2,pinecone:2},'birdhouse')).toBeNull()
 expect(Object.values(recipes).every(r=>Object.keys(r.cost).includes('wood'))).toBe(true)
})
it('the bench opens the patterns once the stool is made; the stool is still for sitting',()=>{
 expect(workshopAction(craftSpot,done,'workshop')).toBe('recipes')
 expect(workshopAction(stoolSeat,done,'workshop')).toBe('inspect')
 expect(workshopAction(craftSpot,{version:1,phase:'carrying'},'workshop')).toBe('craft')
})
it('wood is there once a day and old saves read as before',()=>{
 expect(woodReady(done,2)).toBe(true);expect(woodReady({...done,woodDay:2},2)).toBe(false)
 expect(decodeWorkshop(JSON.stringify({version:1,phase:'finished'}))).toEqual(done)
 expect(decodeWorkshop(JSON.stringify({version:1,phase:'finished',made:['table','table','nope'],woodDay:3}))).toEqual({...done,made:['table'],woodDay:3})
})
it('in play: wood from the pile, then a table at the bench uses three wood and is recorded',async()=>{
 const memory=new Map<string,string>()
 vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})
 vi.resetModules()
 const {useForestStore:s}=await import('./store'),{useInventoryStore:i,installInventory}=await import('./inventoryStore'),{logPile}=await import('../world/settlement')
 const stop=installInventory()
 s.setState({location:'island',mode:'walking',nearby:null,position:{x:logPile.x+.9,z:logPile.z},workshopBook:{...done}})
 s.getState().interact();expect(s.getState().foraging?.source).toBe('wood')
 for(let k=0;k<40;k++)s.getState().tickForage(.05)
 expect(i.getState().inv.items.wood).toBe(2)
 s.getState().interact();expect(s.getState().foraging).toBeNull();expect(s.getState().message).toContain('木料')
 i.getState().give('wood')
 s.setState({location:'workshop',nearby:'workshop',workshopReady:true,position:{...craftSpot}})
 s.getState().interact();expect(s.getState().recipesOpen).toBe(true)
 expect(i.getState().take({wood:3})).toBe(true);expect(s.getState().startRecipe('table')).toBe(true)
 expect(s.getState().mode).toBe('crafting')
 for(let k=0;k<3;k++){s.setState({craft:{...s.getState().craft!,elapsed:.6,stroke:0}});s.getState().interact()}
 for(let k=0;k<40;k++)s.getState().tickWorkshop(.05)
 expect(s.getState().workshopBook.made).toEqual(['table']);expect(s.getState().mode).toBe('walking')
 expect(s.getState().startRecipe('table')).toBe(false)
 stop()
})
