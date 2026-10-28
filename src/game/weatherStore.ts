import {create} from 'zustand'
import {setForcedWeather,weatherIds,type Weather} from './weather'

export const weatherStorageKey='forest-moments:weather:v1'

/** A saved choice, or null (the days' own weather) for anything else, including a broken save. */
export function decodeWeather(raw:string|null):Weather|null{
 return (weatherIds as readonly string[]).includes(raw??'')?raw as Weather:null
}
function load():Weather|null{
 try{return decodeWeather(window.localStorage.getItem(weatherStorageKey))}catch{return null}
}

type WeatherState={forced:Weather|null;choose:(w:Weather|null)=>void}
/** The weather the player picked from the toolbar; null follows the nights slept. Kept on this browser only. */
export const useWeatherStore=create<WeatherState>(set=>{
 const initial=typeof window==='undefined'?null:load()
 setForcedWeather(initial)
 return{forced:initial,choose:w=>{
  setForcedWeather(w)
  set({forced:w})
  try{if(w)window.localStorage.setItem(weatherStorageKey,w);else window.localStorage.removeItem(weatherStorageKey)}catch{/* blocked storage: the choice lasts this visit */}
 }}
})
