import type {ItemCounts} from './inventory'
import type {WorkshopBook} from './workshop'

/**
 * Workshop recipes after the stool (docs/GAMEPLAY_EXPANSION_PLAN.md §2.5): each made once at the bench with the same
 * three-stroke rhythm, from things gathered on the island; the piece then stands at its own fixed place. Pure.
 */
export const recipeIds=['table','birdhouse','rodRack','signpost'] as const
export type RecipeId=typeof recipeIds[number]
export const recipes:Record<RecipeId,{cost:ItemCounts}>={
 table:{cost:{wood:3}},
 birdhouse:{cost:{wood:2,pinecone:2}},
 rodRack:{cost:{wood:2,shell:2}},
 signpost:{cost:{wood:2,wool:1}},
}
export const isRecipe=(id:unknown):id is RecipeId=>typeof id==='string'&&(recipeIds as readonly string[]).includes(id)
export const woodPerDay=2
// One shared empty list: components subscribe to this, and a fresh [] each call would re-render forever.
const none:RecipeId[]=[]
export const madeOf=(book:WorkshopBook):RecipeId[]=>book.made??none
export type RecipeBlock='stool'|'made'|'materials'
/** Why a recipe cannot be started now, or null. `have` is the satchel's counts. */
export function recipeBlock(book:WorkshopBook,have:ItemCounts,id:RecipeId):RecipeBlock|null{
 if(book.phase!=='finished')return 'stool'
 if(madeOf(book).includes(id))return 'made'
 return Object.entries(recipes[id].cost).every(([item,n])=>(have[item as keyof ItemCounts]??0)>=(n??0))?null:'materials'
}
/** Wood from the pile by the workshop, once per day. */
export const woodReady=(book:WorkshopBook,today:number)=>book.woodDay!==today
