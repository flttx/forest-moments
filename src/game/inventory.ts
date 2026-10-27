/**
 * The satchel (docs/GAMEPLAY_EXPANSION_PLAN.md §1.1): counts of things gathered, made or cooked, and which ones the
 * player has ever found (the field guide). No capacity, nothing spoils, nothing is lost. Pure; inventoryStore saves it.
 */
export const inventoryStorageKey='forest-moments:inventory:v1'
/** Items join this list as their play lands (plan stages X2–X4); a save holding an unknown id simply drops it. */
export const itemIds=['roastFish','mushroom','berry','shell','pinecone','egg','wool','wood'] as const
export type ItemId=typeof itemIds[number]
export type ItemCounts=Partial<Record<ItemId,number>>
export interface Inventory{version:1;items:ItemCounts;found:ItemId[]}
export const emptyInventory=():Inventory=>({version:1,items:{},found:[]})
const known=(id:unknown):id is ItemId=>typeof id==='string'&&(itemIds as readonly string[]).includes(id)
const maxCount=999

/** Adds n of an item (and marks it found); returns the same inventory when nothing changes. */
export function addItem(inv:Inventory,id:ItemId,n=1):Inventory{
 if(!known(id)||!Number.isSafeInteger(n)||n<=0)return inv
 return{...inv,items:{...inv.items,[id]:Math.min(maxCount,(inv.items[id]??0)+n)},found:inv.found.includes(id)?inv.found:[...inv.found,id]}
}
export const hasItems=(inv:Inventory,cost:ItemCounts)=>Object.entries(cost).every(([id,n])=>(inv.items[id as ItemId]??0)>=(n??0))
/** Takes a whole cost at once, or nothing (null) when anything is short. Found entries stay found. */
export function takeItems(inv:Inventory,cost:ItemCounts):Inventory|null{
 if(!hasItems(inv,cost))return null
 const items={...inv.items}
 for(const [id,n] of Object.entries(cost) as [ItemId,number][]){const left=(items[id]??0)-n;if(left>0)items[id]=left;else delete items[id]}
 return{...inv,items}
}

export function decodeInventory(raw:string|null):Inventory|null{
 try{
  const v=JSON.parse(raw??'null')
  if(v?.version!==1||!v.items||typeof v.items!=='object'||Array.isArray(v.items)||!Array.isArray(v.found))return null
  const items:ItemCounts={}
  for(const [id,n] of Object.entries(v.items)){
   if(!Number.isSafeInteger(n)||(n as number)<0||(n as number)>maxCount)return null
   if(known(id)&&(n as number)>0)items[id]=n as number
  }
  const found=[...new Set((v.found as unknown[]).filter(known))]
  // Anything held has been found, even if an older save forgot to say so.
  for(const id of Object.keys(items) as ItemId[])if(!found.includes(id))found.push(id)
  return{version:1,items,found}
 }catch{return null}
}
