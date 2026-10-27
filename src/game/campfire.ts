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
export const skySeats=[...campSeats,'coast','reef'] as const
export interface Roast{catchId:string;species:SpeciesId;sizeCm:number;elapsed:number}

type State=Pick<ReturnType<typeof useForestStore.getState>,'mode'|'sitting'|'homeBook'|'fishBook'|'timeOfDay'|'menuPaused'>
const settled=(s:State,seats:readonly string[])=>s.mode==='sitting'&&s.sitting?.phase==='idle'&&seats.includes(s.sitting.id)

/** Catches still on hand: not put in the tank, let go, or roasted. Newest first. */
export const roastable=(s:Pick<State,'fishBook'|'homeBook'>):CatchRecord[]=>s.fishBook.recent.filter(f=>!s.homeBook.usedCatchIds.includes(catchId(f)))
export type RoastBlock='seat'|'fire'|'fish'
/** Why a roast cannot start now, or null. */
export function roastBlock(s:State):RoastBlock|null{
 if(!settled(s,campSeats))return 'seat'
 if(!s.homeBook.fireLit)return 'fire'
 return roastable(s).length?null:'fish'
}
export function beginRoast(s:State):Roast|null{
 if(roastBlock(s))return null
 const f=roastable(s)[0]
 return{catchId:catchId(f),species:kindOf(f),sizeCm:f.sizeCm,elapsed:0}
}
export const canStargaze=(s:State)=>settled(s,skySeats)&&s.timeOfDay==='night'
