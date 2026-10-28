import {useForestStore} from './game/store'
import {useWeatherStore} from './game/weatherStore'
import {naturalWeather,weatherIds,type Weather} from './game/weather'
import {useT,type Key} from './i18n'

/** Pick today's weather by hand, or hand it back to the days; only the picture, sound and today's finds follow. */
export function WeatherPanel(){
 const t=useT(),forced=useWeatherStore(s=>s.forced),choose=useWeatherStore(s=>s.choose),day=useForestStore(s=>s.homeBook.nights)
 const options:[Weather|null,string][]=[[null,t('weather.auto',{weather:t(`weather.${naturalWeather(day)}` as Key)})],...weatherIds.map(w=>[w,t(`weather.${w}` as Key)] as [Weather,string])]
 return <div className="weather-panel">
  <p>{t('weather.hint')}</p>
  <div role="radiogroup" aria-label={t('weather.title')} className="weather-options">
   {options.map(([id,label])=><button key={id??'auto'} type="button" role="radio" aria-checked={forced===id} className="chip" aria-pressed={forced===id} onClick={()=>choose(id)}>{label}</button>)}
  </div>
 </div>
}
