import type {Weather} from './weather'

/**
 * Kinds of fish in the pond (docs/GAMEPLAY_EXPANSION_PLAN.md §2.1). Each is the koi model in its own colours; which
 * one bites depends on the light, and for the mistfish on the weather (docs/GAMEPLAY_TIER1_PLAN.md T1). Rarity only
 * changes the odds, never the difficulty. Pure data and rules.
 */
export type Light='day'|'dusk'|'night'
export const speciesIds=['koi','goldKoi','inkKoi','silverfish','glowfish','mistfish','seaBass','mackerel'] as const
/** Where a kind lives: the pond, or the sea off the jetty. */
export type FishingSite='pond'|'sea'
export type SpeciesId=typeof speciesIds[number]
export interface Species{
 /** Relative odds by light; a missing light means it never bites then. */
 odds:Partial<Record<Light,number>>
 site:FishingSite
 size:readonly [number,number]
 /** Multiplied into the koi texture; `glow` adds a soft emissive of the same hue. */
 tint:string
 glow?:number
 /** Only bites in this weather. */
 weather?:Weather
}
export const species:Record<SpeciesId,Species>={
 koi:{odds:{day:50,dusk:40,night:30},site:'pond',size:[18,36],tint:'#ffffff'},
 goldKoi:{odds:{day:14,dusk:20,night:4},site:'pond',size:[22,36],tint:'#ffd27a'},
 inkKoi:{odds:{day:18,dusk:18,night:16},site:'pond',size:[18,34],tint:'#8f969c'},
 silverfish:{odds:{day:18,dusk:16,night:10},site:'pond',size:[18,24],tint:'#d8e4ee'},
 glowfish:{odds:{night:24},site:'pond',size:[20,30],tint:'#9fe8dc',glow:.55},
 mistfish:{odds:{day:30,dusk:30,night:30},site:'pond',size:[20,32],tint:'#c3d3d6',weather:'mist'},
 seaBass:{odds:{day:30,dusk:30,night:25},site:'sea',size:[24,36],tint:'#a7b0b5'},
 mackerel:{odds:{day:30,dusk:20},site:'sea',size:[20,32],tint:'#7fb3bd'},
}
export const isSpecies=(id:unknown):id is SpeciesId=>typeof id==='string'&&(speciesIds as readonly string[]).includes(id)
export const lightsFor=(id:SpeciesId)=>(Object.keys(species[id].odds) as Light[])
/** A hint for the field guide: the only light it bites in, or the light it is likeliest in (share of that light's ordinary-weather pool). */
export function bestLight(id:SpeciesId):{light:Light;only:boolean}{
 const site=species[id].site,share=(l:Light)=>(species[id].odds[l]??0)/speciesIds.filter(k=>species[k].site===site&&!species[k].weather).reduce((n,k)=>n+(species[k].odds[l]??0),0)
 const lights=lightsFor(id)
 return{light:lights.reduce((a,b)=>share(b)>share(a)?b:a),only:lights.length===1}
}

/** Which fish takes the bait and how big it is. One random number for the kind, one for the size. */
export function pickCatch(light:Light,random=Math.random,site:FishingSite='pond',weather:Weather='clear'):{species:SpeciesId;sizeCm:number}{
 const pool=speciesIds.filter(id=>species[id].site===site&&(species[id].odds[light]??0)>0&&(!species[id].weather||species[id].weather===weather)),total=pool.reduce((n,id)=>n+species[id].odds[light]!,0)
 let roll=random()*total,kind:SpeciesId=pool[pool.length-1]
 for(const id of pool){roll-=species[id].odds[light]!;if(roll<0){kind=id;break}}
 const [min,max]=species[kind].size
 return{species:kind,sizeCm:Math.round(min+random()*(max-min))}
}
