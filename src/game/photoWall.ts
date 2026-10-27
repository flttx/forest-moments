/**
 * The bedroom photo wall (docs/GAMEPLAY_EXPANSION_PLAN.md §2.7): up to six album photos hung in fixed frames.
 * Only photo ids are kept here (localStorage); the pictures stay in the album (IndexedDB). Pure rules.
 */
export const photoWallKey='forest-moments:photo-wall:v1'
export const wallSlots=6

export function decodeWall(raw:string|null):string[]{
 try{
  const v=JSON.parse(raw??'[]')
  if(!Array.isArray(v))return []
  return [...new Set(v.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<64))].slice(0,wallSlots)
 }catch{return []}
}
/** Hangs a photo in the next free frame; unchanged when it already hangs or the wall is full. */
export function hang(wall:readonly string[],id:string):readonly string[]{
 return wall.includes(id)||wall.length>=wallSlots?wall:[...wall,id]
}
export const takeDown=(wall:readonly string[],id:string):readonly string[]=>wall.includes(id)?wall.filter(w=>w!==id):wall
/** Drops frames whose photo is no longer in the album (deleted, or pushed out by newer ones). */
export const keepExisting=(wall:readonly string[],album:readonly string[]):readonly string[]=>wall.every(id=>album.includes(id))?wall:wall.filter(id=>album.includes(id))
