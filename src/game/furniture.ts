import type {RecipeId} from './recipes'

/**
 * Where each finished workshop piece stands (docs/GAMEPLAY_EXPANSION_PLAN.md §2.5, fixed places). Positions were
 * probed against the island's stand rules: standable, off the path, clear of the spawn, the angler and the doors.
 * `rect` is the footprint that blocks walking (half sizes, turned by yaw); the birdhouse hangs above head height.
 */
export interface FurniturePlace{place:'island'|'bedroom';x:number;y?:number;z:number;yaw:number;rect?:{hx:number;hz:number}}
export const furniturePlaces:Record<RecipeId,FurniturePlace>={
 // Bedroom, south-east corner: away from the door (0, 2.5), the bed and the tank.
 table:{place:'bedroom',x:2.85,z:1.85,yaw:0,rect:{hx:.38,hz:.37}},
 // On the trunk of the round tree east of the campfire, facing the fire; its crown starts above 1.9 m.
 birdhouse:{place:'island',x:25.27,y:1.45,z:20.27,yaw:Math.atan2(-5.5,2.85)},
 // Behind the angler at the pond, long side along the bank.
 rodRack:{place:'island',x:-.4,z:-5,yaw:Math.PI/2,rect:{hx:.47,hz:.27}},
 // At the fork just north of the spawn, beside the path.
 signpost:{place:'island',x:1.25,z:2.75,yaw:.6,rect:{hx:.58,hz:.12}},
}

let made:readonly RecipeId[]=[]
/** Tells the walking rules which pieces exist; called whenever the workshop book changes. */
export function setMadeFurniture(ids:readonly RecipeId[]){made=ids}
/** Whether a footprint of a made piece in this place holds the point (padded by the walker's radius). */
export function furnitureAt(place:'island'|'bedroom',x:number,z:number,pad:number){
 for(const id of made){
  const f=furniturePlaces[id];if(f.place!==place||!f.rect)continue
  const dx=x-f.x,dz=z-f.z,c=Math.cos(f.yaw),s=Math.sin(f.yaw)
  const u=c*dx-s*dz,w=s*dx+c*dz
  if(Math.hypot(Math.max(Math.abs(u)-f.rect.hx,0),Math.max(Math.abs(w)-f.rect.hz,0))<pad)return id
 }
 return null
}
