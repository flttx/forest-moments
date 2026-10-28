/**
 * Weather and seasons (docs/GAMEPLAY_EXPANSION_PLAN.md §2.8, decision D3): both follow the nights slept, never the
 * computer clock, so nothing new is saved. Three seasons (spring, summer, autumn) of four nights each; each morning
 * draws clear, cloudy, light rain or mist from a seed. Only the picture and sound change. Pure.
 */
export const seasonIds=['spring','summer','autumn'] as const
export type Season=typeof seasonIds[number]
export const weatherIds=['clear','cloudy','rain','mist'] as const
export type Weather=typeof weatherIds[number]
export const nightsPerSeason=4
const weatherOdds:Record<Weather,number>={clear:45,cloudy:25,rain:15,mist:15}

export const seasonFor=(day:number)=>seasonIds[Math.floor(Math.max(0,day)/nightsPerSeason)%seasonIds.length]
/** The day's weather; the first morning is always clear so a new island starts in sunshine. */
export function weatherFor(day:number):Weather{
 if(day<=0)return 'clear'
 let n=(Math.floor(day)*2654435761+97)%4294967296
 n=(n*1664525+1013904223)%4294967296
 let roll=n/4294967296*100
 for(const id of weatherIds){roll-=weatherOdds[id];if(roll<0)return id}
 return 'clear'
}

/** What a sky and season do to the picture; the scene eases toward these numbers. */
export interface ClimateLook{
 /** Extra cloud cover, 0 none to 1 overcast. */
 overcast:number
 /** Multiplier on direct sun and sky fill. */
 light:number
 /** Multiplier on fog distances (smaller is thicker). */
 fog:number
 /** Ground darkening from rain, 0..1. */
 wet:number
 /** Rain streak density, 0..1. */
 rain:number
 /** Season colour multiplied into broadleaf crowns, pines, and grass and turf. */
 broadleaf:[number,number,number]
 pine:[number,number,number]
 grass:[number,number,number]
 /** Falling leaves, 0..1. */
 leaves:number
}
const seasonColours:Record<Season,Pick<ClimateLook,'broadleaf'|'pine'|'grass'|'leaves'>>={
 spring:{broadleaf:[1.04,1.12,.9],pine:[1.02,1.06,.98],grass:[1.04,1.1,.88],leaves:0},
 summer:{broadleaf:[1,1,1],pine:[1,1,1],grass:[1,1,1],leaves:0},
 autumn:{broadleaf:[1.45,.95,.42],pine:[.95,.94,.86],grass:[1.18,1,.68],leaves:.6},
}
const weatherLook:Record<Weather,Pick<ClimateLook,'overcast'|'light'|'fog'|'wet'|'rain'>>={
 clear:{overcast:0,light:1,fog:1,wet:0,rain:0},
 cloudy:{overcast:.55,light:.72,fog:.85,wet:0,rain:0},
 rain:{overcast:.9,light:.55,fog:.45,wet:1,rain:1},
 mist:{overcast:.35,light:.8,fog:.14,wet:.25,rain:0},
}
export const climateLook=(weather:Weather,season:Season):ClimateLook=>({...weatherLook[weather],...seasonColours[season]})
