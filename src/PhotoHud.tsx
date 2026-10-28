import {useEffect,useState} from 'react'
import {useLang,useT} from './i18n'
import {Icon,type IconName} from './Icon'
import {useForestStore} from './game/store'
import {usePhotoStore} from './game/photoStore'
import {wallSlots} from './game/photoWall'
import {subjectIds,type SubjectId} from './game/photoSubjects'
import {filterAllowed,photoBlock,albumLimit,filterIds,frameIds,filterUnlock,frameUnlock,looksUnlocked} from './game/photo'
import {useJournalStore} from './game/journalStore'
import {seasonFor,seasonIds,weatherFor,weatherIds} from './game/weather'
import {useWeatherStore} from './game/weatherStore'
import {deletePhoto,listPhotos,type PhotoRecord} from './game/photoAlbum'

const lights=['day','dusk','night'] as const
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Toolbar button that opens photo mode; greyed with the reason when the raccoon is mid-task. */
export function PhotoButton(){
 const t=useT(),enter=usePhotoStore(s=>s.enter)
 const block=useForestStore(s=>photoBlock(s))
 const reason=block==='busy'?t('photo.busy'):block==='transition'?t('photo.transition'):undefined
 return <button type="button" className="tool-button" aria-disabled={reason?true:undefined} title={reason??`${t('menu.photo')} (P)`} aria-label={t('menu.photo')} onClick={enter}>
  <Icon name="camera"/><span className="tool-label">{t('menu.photo')}</span>
 </button>
}

/** What is on screen while the camera is out: a slim tool strip, the shutter, a flash and the last picture. */
export function PhotoHud(){
 const t=useT()
 const s=usePhotoStore(),light=useForestStore(f=>f.timeOfDay),pages=useJournalStore(j=>j.book.stamps.length)
 const [looksOpen,setLooksOpen]=useState(false)
 useWeatherStore(w=>w.forced)
 const day=useForestStore(f=>f.homeBook.nights),todayWeather=weatherFor(day),todaySeason=seasonFor(day)
 if(!s.active)return null
 const lightIcon={day:'sun',dusk:'sunset',night:'moon'} as const
 // Icon buttons keep their words for screen readers (and scripts) in a hidden span; the title shows them on hover.
 const icon=(label:string,name:IconName,pressed:boolean|undefined,onClick:()=>void,extra?:string)=>
  <button type="button" className="icon-button" aria-pressed={pressed} title={extra?`${label} · ${extra}`:label} onClick={onClick}><Icon name={name} size={19}/><span className="sr-only">{label}</span></button>
 return <>
  {s.flash>0&&!reducedMotion()&&<div key={s.flash} className="photo-flash" aria-hidden="true"/>}
  <div className="viewfinder" aria-hidden="true"><i/><i/><i/><i/></div>
  {looksOpen&&<div className="photo-looks photo-styles" role="group" aria-label={t('photo.filters')}>
   {filterIds.map(id=>{const open=looksUnlocked(pages,filterUnlock[id]),usable=filterAllowed(id,s.lowQuality);return <button key={id} type="button" className="chip" aria-pressed={s.filter===id&&usable} aria-disabled={open&&usable?undefined:true} data-tip={!open?t('photo.locked',{n:filterUnlock[id]}):usable?undefined:t('photo.lowQuality')} onClick={()=>{if(usable)s.setFilter(id)}}>{t(`photo.filter.${id}` as const)}</button>})}
   <span className="rule" aria-hidden="true"/>
   {frameIds.map(id=>{const open=looksUnlocked(pages,frameUnlock[id]);return <button key={id} type="button" className="chip" aria-pressed={s.frame===id} aria-disabled={open?undefined:true} data-tip={open?undefined:t('photo.locked',{n:frameUnlock[id]})} onClick={()=>s.setFrame(id)}>{t(`photo.frame.${id}` as const)}</button>})}
   <span className="rule" aria-hidden="true"/>
   {weatherIds.map(w=><button key={w} type="button" className="chip" aria-pressed={(s.weatherPreview??todayWeather)===w} title={t('photo.previewOnly')} onClick={()=>s.setWeatherPreview(w===todayWeather?null:w)}>{t(`weather.${w}` as const)}</button>)}
   <span className="rule" aria-hidden="true"/>
   {seasonIds.map(v=><button key={v} type="button" className="chip" aria-pressed={(s.seasonPreview??todaySeason)===v} title={t('photo.previewOnly')} onClick={()=>s.setSeasonPreview(v===todaySeason?null:v)}>{t(`season.${v}` as const)}</button>)}
  </div>}
  <p key={s.free?'free':'orbit'} className="photo-hint">{t(s.free?'photo.hintFree':'photo.hint')}</p>
  <div className="photo-strip photo-bar" role="toolbar" aria-label={t('photo.label')}>
   <div className="group" role="group" aria-label={t('photo.light')}>
    {lights.map(l=><span key={l}>{icon(t(`photo.light.${l}` as const),lightIcon[l],light===l,()=>s.setLight(l))}</span>)}
   </div>
   {icon(t('photo.looks'),'sparkles',looksOpen,()=>setLooksOpen(v=>!v))}
   <button type="button" className="shutter" aria-label={t('photo.shutter')} title={`${t('photo.shutter')} (Space)`} aria-busy={s.pending} onClick={s.shutter}><span/></button>
   {icon(t('photo.free'),'move',s.free,s.toggleFree,t('photo.freeHint'))}
   {icon(t('photo.hideRaccoon'),'hide',s.hideRaccoon,s.toggleHideRaccoon)}
   <span className="rule" aria-hidden="true"/>
   {icon(`${t('photo.close')} (Esc)`,'close',undefined,s.exit)}
  </div>
  {s.last&&<figure className="paper-note photo-last">
   <img src={s.last.url} alt={t('photo.taken')}/>
   <figcaption>{t('photo.taken')}{s.last.saved?` · ${t('photo.savedAlbum')}`:''}{s.last.subjects.length>0&&<><br/>{t('photo.subjects',{list:s.last.subjects.map(id=>t(`subject.${id}` as const)).join(t('list.separator'))})}</>}</figcaption>
   <a className="tool-button" href={s.last.url} download={s.last.name}>{t('photo.download')}</a>
   <button type="button" className="close-button" onClick={s.dismissLast} aria-label={t('photo.dismiss')}><Icon name="close"/></button>
  </figure>}
 </>
}

/** The menu album: thumbnails of the latest photos, filterable by what they show; each can be downloaded, hung on the bedroom wall or deleted. */
export function AlbumPanel(){
 const t=useT(),lang=useLang(s=>s.lang),version=usePhotoStore(s=>s.albumVersion)
 const wall=usePhotoStore(s=>s.wall),toggleWall=usePhotoStore(s=>s.toggleWall),pruneWall=usePhotoStore(s=>s.pruneWall)
 const [items,setItems]=useState<{record:PhotoRecord;url:string}[]|null>(null)
 const [failed,setFailed]=useState(false),[tick,setTick]=useState(0),[only,setOnly]=useState<SubjectId|null>(null)
 useEffect(()=>{
  let urls:string[]=[],live=true
  listPhotos().then(records=>{
   const made=records.map(record=>({record,url:URL.createObjectURL(record.thumb)}))
   urls=made.map(m=>m.url)
   if(live){setItems(made);pruneWall(records.map(r=>r.id))}else urls.forEach(u=>URL.revokeObjectURL(u))
  }).catch(()=>{if(live)setFailed(true)})
  return()=>{live=false;urls.forEach(u=>URL.revokeObjectURL(u))}
 },[version,tick,pruneWall])
 if(failed)return <p className="empty">{t('album.unavailable')}</p>
 if(!items)return null
 if(!items.length)return <p className="empty">{t('album.empty')}</p>
 const date=(at:string)=>new Date(at).toLocaleString(lang==='zh'?'zh-CN':'en-GB',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
 const download=(r:PhotoRecord)=>{
  const url=URL.createObjectURL(r.image),a=document.createElement('a')
  a.href=url;a.download=`forest-moments-${r.id.split('-')[0]}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 const tags=subjectIds.filter(id=>items.some(i=>i.record.subjects?.includes(id)))
 const shown=only?items.filter(i=>i.record.subjects?.includes(only)):items
 return <><p>{t('album.note',{n:albumLimit})} {t('wall.count',{n:wall.length,total:wallSlots})}</p>
  {tags.length>0&&<div className="album-tags" role="group" aria-label={t('album.filter')}>
   <button type="button" className="tool-button" aria-pressed={only===null} onClick={()=>setOnly(null)}>{t('album.all')}</button>
   {tags.map(id=><button key={id} type="button" className="tool-button" aria-pressed={only===id} onClick={()=>setOnly(id)}>{t(`subject.${id}` as const)}</button>)}
  </div>}
  <ul className="album-grid">{shown.map(({record,url})=>{const hung=wall.includes(record.id);return <li key={record.id}>
  <img src={url} alt={t('album.photoLabel',{date:date(record.at)})} loading="lazy"/>
  <span>{date(record.at)}{record.subjects?.length?` · ${record.subjects.map(id=>t(`subject.${id}` as const)).join(t('list.separator'))}`:''}</span>
  <div>
   <button type="button" className="tool-button" aria-label={t('album.downloadLabel')} onClick={()=>download(record)}>{t('photo.download')}</button>
   <button type="button" className="tool-button" aria-pressed={hung} disabled={!hung&&wall.length>=wallSlots} title={!hung&&wall.length>=wallSlots?t('wall.full'):undefined} onClick={()=>toggleWall(record.id)}>{t(hung?'wall.takeDown':'wall.hang')}</button>
   <button type="button" className="tool-button" aria-label={t('album.deleteLabel')} onClick={()=>{void deletePhoto(record.id).finally(()=>setTick(n=>n+1))}}>{t('album.delete')}</button>
  </div>
 </li>})}</ul></>
}
