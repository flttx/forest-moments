import {tidePools} from '../world/tideIsland'

/**
 * One small creature lives in each Tide Isle pool. Standing at the pool's rim beside it, F records it in the tide-pool
 * guide (kept with the island travel record). Positions sit on the pool bed, a little off centre.
 */
export const tideCreatureIds=['starfish','hermitCrab','anemone'] as const
export type TideCreatureId=typeof tideCreatureIds[number]
export const tideCreatures:readonly {id:TideCreatureId;pool:number;x:number;z:number}[]=tideCreatureIds.map((id,pool)=>{
 const p=tidePools[pool],offset=[[.6,-.3],[-.35,.25],[.25,.3]][pool]
 return{id,pool,x:p.x+offset[0]*p.rx,z:p.z+offset[1]*p.rz}
})
/** Close enough to see into the pool: within its long radius plus a step from the creature. */
export const observeReach=(pool:number)=>Math.max(tidePools[pool].rx,tidePools[pool].rz)+1.1
/** The creature the raccoon can look at from here, or null. Recorded ones are offered again only as a look, not a record. */
export function creatureNear(p:{x:number;z:number}){
 return tideCreatures.find(c=>Math.hypot(p.x-c.x,p.z-c.z)<observeReach(c.pool))??null
}
export function recordCreature(found:readonly TideCreatureId[],id:TideCreatureId):TideCreatureId[]{
 return found.includes(id)?[...found]:[...found,id]
}
export const isTideCreature=(id:unknown):id is TideCreatureId=>typeof id==='string'&&(tideCreatureIds as readonly string[]).includes(id)
