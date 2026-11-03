import type {useForestStore} from './store'
import {catchId} from './expansion'
import {kindOf,type CatchRecord} from './fishing'
import type {SpeciesId} from './fishSpecies'

/**
 * Campfire evenings (docs/GAMEPLAY_EXPANSION_PLAN.md §2.2): roast a fish while sitting by a lit fire, or look up at
 * the stars from a seat at night. Leaving the seat simply stops either; nothing is lost. Pure rules.
 */
export const roastSeconds=6
export const campSeats=['camp-west','camp-south','camp-east'] as const
export const skySeats=[...campSeats,'coast','reef','falls'] as const
/** A fish from the day's catches, or (with no fish on hand) a Mist Isle cap from the satchel. */
export type Roast={item:'fish';catchId:string;species:SpeciesId;sizeCm:number;elapsed:number}|{item:'mistcap';elapsed:number}

type State=Pick<ReturnType<typeof useForestStore.getState>,'mode'|'sitting'|'homeBook'|'fishBook'|'timeOfDay'|'menuPaused'>
const settled=(s:State,seats:readonly string[])=>s.mode==='sitting'&&s.sitting?.phase==='idle'&&seats.includes(s.sitting.id)

/** Catches still on hand: not put in the tank, let go, or roasted. Newest first. */
export const roastable=(s:Pick<State,'fishBook'|'homeBook'>):CatchRecord[]=>s.fishBook.recent.filter(f=>!s.homeBook.usedCatchIds.includes(catchId(f)))
export type RoastBlock='seat'|'fire'|'fish'
/** Why a roast cannot start now, or null. `caps` is how many mist caps the satchel holds. */
export function roastBlock(s:State,caps=0):RoastBlock|null{
 if(!settled(s,campSeats))return 'seat'
 if(!s.homeBook.fireLit)return 'fire'
 return roastable(s).length||caps>0?null:'fish'
}
/** Fish first, as before; a cap only when no catch is on hand. */
export function beginRoast(s:State,caps=0):Roast|null{
 if(roastBlock(s,caps))return null
 const f=roastable(s)[0]
 return f?{item:'fish',catchId:catchId(f),species:kindOf(f),sizeCm:f.sizeCm,elapsed:0}:{item:'mistcap',elapsed:0}
}
export const canStargaze=(s:State)=>settled(s,skySeats)&&s.timeOfDay==='night'
