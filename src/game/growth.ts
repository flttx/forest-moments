export const growthStorageKey='forest-moments:tree:v2'
export const legacySeedlingKey='forest-moments:seedling:v1'
export const plantingSpot={x:0,z:8}
export const plantingStand={x:0,z:9.15}
/** Stage names are translated by id (i18n `growth.<id>`). */
export const growthStages=[
  {id:'sprout',height:.22,at:0},
  {id:'seedling',height:.55,at:45000},
  {id:'young',height:1.5,at:120000},
  {id:'mature',height:3,at:240000},
] as const
export type PlantedTree={version:2;plantedAt:number;stage:number}
export function advanceTree(tree:PlantedTree,now:number):PlantedTree{
  const elapsed=Math.max(0,now-tree.plantedAt)
  let stage=tree.stage
  for(let i=0;i<growthStages.length;i++)if(elapsed>=growthStages[i].at)stage=Math.max(stage,i)
  return stage===tree.stage?tree:{...tree,stage}
}
export function decodeTree(raw:string|null,legacy:string|null,now:number):PlantedTree|null{
  try{
    const value=JSON.parse(raw??'null')
    if(value?.version===2&&Number.isFinite(value.plantedAt)&&value.plantedAt>=0&&Number.isInteger(value.stage)&&value.stage>=0&&value.stage<4)
      return advanceTree({...value,plantedAt:Math.min(now,value.plantedAt)},now)
  }catch{/* Invalid data is ignored; legacy progress can still be recovered. */}
  return legacy==='true'?{version:2,plantedAt:now-growthStages[1].at,stage:1}:null
}
export function growthRemaining(tree:PlantedTree,now:number){
  const next=growthStages[tree.stage+1]
  return next?Math.max(0,Math.ceil((next.at-Math.max(0,now-tree.plantedAt))/1000)):0
}
