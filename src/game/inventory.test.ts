import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {addItem,decodeInventory,emptyInventory,hasItems,inventoryStorageKey,takeItems} from './inventory'

let memory:Map<string,string>
beforeEach(()=>{vi.resetModules();memory=new Map();vi.stubGlobal('window',{location:{search:''},localStorage:{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}})})
afterEach(()=>vi.unstubAllGlobals())

it('adds items, remembers what was found, and ignores nonsense',()=>{
 const a=addItem(emptyInventory(),'roastFish',2)
 expect(a).toEqual({version:1,items:{roastFish:2},found:['roastFish']})
 expect(addItem(a,'roastFish',0)).toBe(a)
 expect(addItem(a,'roastFish',-1)).toBe(a)
 expect(addItem(a,'nope' as never)).toBe(a)
 expect(addItem(a,'roastFish',5000).items.roastFish).toBe(999)
})
it('takes a whole cost or nothing; found entries stay',()=>{
 const a=addItem(emptyInventory(),'roastFish',2)
 expect(hasItems(a,{roastFish:3})).toBe(false)
 expect(takeItems(a,{roastFish:3})).toBeNull()
 const b=takeItems(a,{roastFish:2})!
 expect(b.items).toEqual({});expect(b.found).toEqual(['roastFish'])
})
it('restores a valid save, drops unknown ids, rejects a broken one',()=>{
 expect(decodeInventory(JSON.stringify({version:1,items:{roastFish:3,later:4},found:['later']}))).toEqual({version:1,items:{roastFish:3},found:['roastFish']})
 for(const raw of ['bad','{}',JSON.stringify({version:2,items:{},found:[]}),JSON.stringify({version:1,items:{roastFish:-1},found:[]}),JSON.stringify({version:1,items:{roastFish:1.5},found:[]}),JSON.stringify({version:1,items:[],found:[]})])
  expect(decodeInventory(raw)).toBeNull()
})
it('saves on change, says so once when storage refuses, and resets a broken save with a notice',async()=>{
 memory.set(inventoryStorageKey,'broken')
 const {useInventoryStore:i}=await import('./inventoryStore'),{useForestStore:s}=await import('./store')
 await Promise.resolve()
 expect(i.getState().inv).toEqual(emptyInventory());expect(s.getState().messageKind).toBe('error')
 i.getState().give('roastFish')
 expect(JSON.parse(memory.get(inventoryStorageKey)!).items).toEqual({roastFish:1})
 expect(i.getState().take({roastFish:2})).toBe(false)
 window.localStorage.setItem=()=>{throw Error('denied')}
 s.setState({message:'',messageKind:'info'})
 i.getState().give('roastFish');expect(i.getState().inv.items.roastFish).toBe(2);expect(s.getState().messageKind).toBe('error')
})
