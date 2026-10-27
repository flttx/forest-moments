import {create} from 'zustand'
import {t} from '../i18n'
import {useForestStore} from './store'
import {addItem,decodeInventory,emptyInventory,inventoryStorageKey,takeItems,type Inventory,type ItemCounts,type ItemId} from './inventory'

function load():Inventory{
 try{
  const raw=window.localStorage.getItem(inventoryStorageKey)
  const saved=decodeInventory(raw)
  // A save that exists but cannot be read starts afresh, and says so once.
  if(raw!==null&&!saved)queueMicrotask(()=>useForestStore.setState({message:t('inventory.reset'),messageKind:'error'}))
  return saved??emptyInventory()
 }catch{return emptyInventory()}
}
let warned=false
function save(inv:Inventory){
 try{window.localStorage.setItem(inventoryStorageKey,JSON.stringify(inv))}
 catch{if(!warned){warned=true;useForestStore.setState({message:t('inventory.unsaved'),messageKind:'error'})}}
}

/** Hands over what the island produces as it happens: roasted fish and anything gathered. Returns the cleanup. */
export function installInventory(){
 return useForestStore.subscribe((next,prev)=>{
  if(next.roasted>prev.roasted)useInventoryStore.getState().give('roastFish',next.roasted-prev.roasted)
  if(next.harvest&&next.harvest.seq!==prev.harvest?.seq)useInventoryStore.getState().give(next.harvest.item,next.harvest.n??1)
 })
}

type InventoryState={inv:Inventory;give:(id:ItemId,n?:number)=>void;take:(cost:ItemCounts)=>boolean}
export const useInventoryStore=create<InventoryState>((set,get)=>({
 inv:typeof window==='undefined'?emptyInventory():load(),
 give:(id,n=1)=>{const inv=addItem(get().inv,id,n);if(inv===get().inv)return;set({inv});save(inv)},
 take:cost=>{const inv=takeItems(get().inv,cost);if(!inv)return false;set({inv});save(inv);return true},
}))
