export const growthStorageKey='forest-moments:tree:v3'
export const growthStorageKeyV2='forest-moments:tree:v2'
export const legacySeedlingKey='forest-moments:seedling:v1'
/**
 * Plots where a tree can be planted (docs/GAMEPLAY_TIER1_PLAN.md T3): the original sapling corner first, then five
 * open patches around the island, each clear of paths, buildings, plants and finds (scripts check them in growth.test).
 */
export const plantingSpots=[
  {x:0,z:8},
  {x:-10,z:14.5},
  {x:12,z:11},
  {x:26,z:14},
  {x:4,z:-26},
  {x:-29,z:-2.5},
] as const
export const plantingSpot=plantingSpots[0]
/** How close the raccoon has to be to a plot to plant or look at it. */
export const plotReach=1.8
/** Stage names are translated by id (i18n `growth.<id>`). */
export const growthStages=[
  {id:'sprout',height:.22,at:0},
  {id:'seedling',height:.55,at:45000},
  {id:'young',height:1.5,at:120000},
  {id:'mature',height:3,at:240000},
] as const
/** Trunk radius the raccoon walks around, and the push-out radius when a tree grows under it, by stage. */
export const trunkRadius=[.06,.11,.19,.32] as const
export const pushRadius=[.34,.39,.47,.6] as const
/** `day`: the island day (nights slept) it was planted; one new tree a day. */
export type PlantedTree={spot:number;plantedAt:number;stage:number;day:number}
export type Garden={version:3;trees:PlantedTree[]}
export const emptyGarden=():Garden=>({version:3,trees:[]})

export function advanceTree(tree:PlantedTree,now:number):PlantedTree{
  const elapsed=Math.max(0,now-tree.plantedAt)
  let stage=tree.stage
  for(let i=0;i<growthStages.length;i++)if(elapsed>=growthStages[i].at)stage=Math.max(stage,i)
  return stage===tree.stage?tree:{...tree,stage}
}
/** Every tree moved on to now; the same garden when nothing grew. */
export function advanceGarden(garden:Garden,now:number):Garden{
  const trees=garden.trees.map(t=>advanceTree(t,now))
  return trees.every((t,i)=>t===garden.trees[i])?garden:{...garden,trees}
}
export const treeAt=(garden:Garden,spot:number)=>garden.trees.find(t=>t.spot===spot)??null
export const plantedToday=(garden:Garden,day:number)=>garden.trees.some(t=>t.day===day)
/** The nearest plot within reach, or null. */
export function plotNear(p:{x:number;z:number}):number|null{
  let best:number|null=null,distance=plotReach
  plantingSpots.forEach((s,i)=>{const d=Math.hypot(p.x-s.x,p.z-s.z);if(d<distance){best=i;distance=d}})
  return best
}
/** Where to stand while planting: no closer than 0.8 m, so the raccoon is not inside the sapling. */
export function plantingStand(p:{x:number;z:number},spot:number){
  const s=plantingSpots[spot],dx=p.x-s.x,dz=p.z-s.z,d=Math.hypot(dx,dz)
  return d<.65?{x:s.x+(d?dx/d:0)*.8,z:s.z+(d?dz/d:1)*.8}:{...p}
}
export function plant(garden:Garden,spot:number,now:number,day:number):Garden{
  if(treeAt(garden,spot)||plantedToday(garden,day)||!plantingSpots[spot])return garden
  return{...garden,trees:[...garden.trees,{spot,plantedAt:now,stage:0,day}]}
}
/** Trunks for the walking check. */
export const trunks=(garden:Garden)=>garden.trees.map(t=>({...plantingSpots[t.spot],r:trunkRadius[t.stage]}))

const validTree=(t:PlantedTree,now:number)=>t&&Number.isInteger(t.spot)&&t.spot>=0&&t.spot<plantingSpots.length&&Number.isFinite(t.plantedAt)&&t.plantedAt>=0&&
  Number.isInteger(t.stage)&&t.stage>=0&&t.stage<growthStages.length&&Number.isSafeInteger(t.day)&&t.day>=0&&t.plantedAt<=now+864e5
/** The saved garden; falls back to the single v2 tree (moved to the first plot) or the v1 seedling flag. */
export function decodeGarden(raw:string|null,v2:string|null,legacy:string|null,now:number):Garden{
  try{
    const value=JSON.parse(raw??'null')
    if(value?.version===3&&Array.isArray(value.trees)&&value.trees.length<=plantingSpots.length&&value.trees.every((t:PlantedTree)=>validTree(t,now))&&
      new Set(value.trees.map((t:PlantedTree)=>t.spot)).size===value.trees.length)
      return advanceGarden({version:3,trees:value.trees.map((t:PlantedTree)=>({spot:t.spot,plantedAt:Math.min(now,t.plantedAt),stage:t.stage,day:t.day}))},now)
  }catch{/* Invalid data is ignored; an older save can still be recovered. */}
  try{
    const value=JSON.parse(v2??'null')
    if(value?.version===2&&Number.isFinite(value.plantedAt)&&value.plantedAt>=0&&Number.isInteger(value.stage)&&value.stage>=0&&value.stage<4)
      return advanceGarden({version:3,trees:[{spot:0,plantedAt:Math.min(now,value.plantedAt),stage:value.stage,day:0}]},now)
  }catch{/* As above. */}
  return legacy==='true'?advanceGarden({version:3,trees:[{spot:0,plantedAt:now-growthStages[1].at,stage:1,day:0}]},now):emptyGarden()
}
export function growthRemaining(tree:PlantedTree,now:number){
  const next=growthStages[tree.stage+1]
  return next?Math.max(0,Math.ceil((next.at-Math.max(0,now-tree.plantedAt))/1000)):0
}
