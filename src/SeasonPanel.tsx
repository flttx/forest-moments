import {useEffect,useRef,useState} from 'react'
import {useT,type Key} from './i18n'
import {useSeasonStore} from './game/seasonStore'
import {listPhotos} from './game/photoAlbum'
import {inRecap,tallyIds,type SeasonRecap} from './game/seasons'

// A stable empty list: a fresh [] from a selector would re-render forever.
const none:SeasonRecap[]=[]

/** Up to four pictures from the season that are still in the album (it keeps only the newest few). */
function RecapPhotos({recap}:{recap:SeasonRecap}){
 const t=useT()
 const [urls,setUrls]=useState<string[]|null>(null)
 useEffect(()=>{
  let made:string[]=[],live=true
  listPhotos().then(records=>{
   made=records.filter(r=>inRecap(recap,r.day)).slice(0,4).map(r=>URL.createObjectURL(r.thumb))
   if(live)setUrls(made);else made.forEach(u=>URL.revokeObjectURL(u))
  }).catch(()=>{if(live)setUrls([])})
  return()=>{live=false;made.forEach(u=>URL.revokeObjectURL(u))}
 },[recap])
 if(!urls)return null
 if(!urls.length)return <p className="empty">{t('season.noPhotos')}</p>
 return <ul className="recap-photos">{urls.map((url,i)=><li key={url}><img src={url} alt={t('season.photo',{n:i+1})}/></li>)}</ul>
}

/** A season looked back on: what the island saw from its first to its last day, and some of its pictures. */
export function SeasonPanel(){
 const t=useT()
 const recaps=useSeasonStore(s=>s.book?.recaps??none),index=useSeasonStore(s=>s.viewing),view=useSeasonStore(s=>s.view)
 const title=useRef<HTMLParagraphElement>(null)
 const recap=recaps[Math.min(index,recaps.length-1)]
 if(!recap)return <p className="empty">{t('season.none')}</p>
 const at=recaps.indexOf(recap),show=(i:number)=>{view(i);requestAnimationFrame(()=>title.current?.focus())}
 const rows=tallyIds.filter(id=>recap.tally[id]>0)
 return <div className="season-recap">
  <nav className="journal-nav" aria-label={t('season.browse')}>
   <button type="button" disabled={at<=0} onClick={()=>show(at-1)} aria-label={t('season.previous')}>←</button>
   <p ref={title} className="journal-page" tabIndex={-1}>{t('season.heading',{season:t(`season.${recap.season}`)})}</p>
   <button type="button" disabled={at>=recaps.length-1} onClick={()=>show(at+1)} aria-label={t('season.next')}>→</button>
  </nav>
  <p className="recap-days">{t('season.days',{from:recap.startDay+1,to:recap.endDay})}</p>
  {rows.length?<ul className="recap-tally">{rows.map(id=><li key={id}><span>{t(`season.tally.${id}` as Key)}</span><strong>{recap.tally[id]}</strong></li>)}</ul>:<p className="empty">{t('season.quiet')}</p>}
  <RecapPhotos recap={recap}/>
 </div>
}
