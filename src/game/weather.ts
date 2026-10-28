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
 // A mixing hash (mulberry32's output step): a linear one gave weeks-long runs in a fixed clear→cloudy→rain→mist order.
 let n=(Math.floor(day)*0x9e3779b9+0x6d2b79f5)|0
 n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61)
 let roll=((n^n>>>14)>>>0)/4294967296*100
 for(const id of weatherIds){roll-=weatherOdds[id];if(roll<0)return id}
 return 'clear'
}

/** The morning after a rainy day, if it has cleared up, a rainbow stands over the sea through the day (plan T1). */
export const rainbowFor=(day:number)=>day>0&&weatherFor(day-1)==='rain'&&['clear','cloudy'].includes(weatherFor(day))
/** On a rainy day mushrooms come up more freely (plan T1); the other finds are unchanged. */
export const rainMushrooms=8

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
 /** Flower heads in the grass, as a multiple of summer's. */
 bloom:number
 /** Fallen leaves lying on the ground, 0..1. */
 litter:number
 /** Fireflies, 0..1: summer nights are full of them, and they come out at dusk too. */
 fireflies:number
 /** Share of the day butterflies flying, 0..1. */
 butterflies:number
 /** How far broadleaf crowns have turned to rust and amber, 0..1. */
 turn:number
}
type SeasonLook=Pick<ClimateLook,'broadleaf'|'pine'|'grass'|'leaves'|'bloom'|'litter'|'fireflies'|'butterflies'|'turn'>
const seasonColours:Record<Season,SeasonLook>={
 spring:{broadleaf:[1.04,1.12,.9],pine:[1.02,1.06,.98],grass:[1.04,1.1,.88],leaves:0,bloom:2.2,litter:0,fireflies:.35,butterflies:1,turn:0},
 summer:{broadleaf:[1,1,1],pine:[1,1,1],grass:[1,1,1],leaves:0,bloom:1,litter:0,fireflies:1,butterflies:.8,turn:0},
 autumn:{broadleaf:[1.2,1,.8],pine:[.95,.94,.86],grass:[1.18,1,.68],leaves:.75,bloom:.25,litter:1,fireflies:.2,butterflies:.25,turn:.85},
}
const weatherLook:Record<Weather,Pick<ClimateLook,'overcast'|'light'|'fog'|'wet'|'rain'>>={
 clear:{overcast:0,light:1,fog:1,wet:0,rain:0},
 cloudy:{overcast:.55,light:.72,fog:.85,wet:0,rain:0},
 rain:{overcast:.95,light:.48,fog:.42,wet:1,rain:1},
 mist:{overcast:.35,light:.8,fog:.14,wet:.25,rain:0},
}
export const climateLook=(weather:Weather,season:Season):ClimateLook=>({...weatherLook[weather],...seasonColours[season]})
