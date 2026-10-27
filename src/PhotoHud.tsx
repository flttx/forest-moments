import {useEffect,useState} from 'react'
import {useLang,useT} from './i18n'
import {Icon} from './Icon'
import {useForestStore} from './game/store'
import {usePhotoStore} from './game/photoStore'
import {photoBlock,albumLimit,filterIds,frameIds,filterUnlock,frameUnlock,looksUnlocked} from './game/photo'
import {useJournalStore} from './game/journalStore'
import {deletePhoto,listPhotos,type PhotoRecord} from './game/photoAlbum'

const lights=['day','dusk','night'] as const
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Toolbar button that opens photo mode; greyed with the reason when the raccoon is mid-task. */
export function PhotoButton(){
 const t=useT(),enter=usePhotoStore(s=>s.enter)
 const block=useForestStore(s=>photoBlock(s))
 const reason=block==='busy'?t('photo.busy'):block==='transition'?t('photo.transition'):undefined
 return <button type="button" className="tool-button" aria-disabled={reason?true:undefined} title={reason??`${t('menu.photo')} (P)`} onClick={enter}>
  <Icon name="camera"/><span className="tool-label">{t('menu.photo')}</span>
 </button>
}

/** What is on screen while the camera is out: a slim tool strip, the shutter, a flash and the last picture. */
export function PhotoHud(){
 const t=useT()
 const s=usePhotoStore(),light=useForestStore(f=>f.timeOfDay),pages=useJournalStore(j=>j.book.stamps.length)
 if(!s.active)return null
 return <>
  {s.flash>0&&!reducedMotion()&&<div key={s.flash} className="photo-flash" aria-hidden="true"/>}
  <div className="photo-styles paper-note">
   <div role="group" aria-label={t('photo.filters')}>
    {filterIds.map(id=>{const open=looksUnlocked(pages,filterUnlock[id]);return <button key={id} type="button" className="tool-button" aria-pressed={s.filter===id} aria-disabled={open?undefined:true} title={open?undefined:t('photo.locked',{n:filterUnlock[id]})} onClick={()=>s.setFilter(id)}>{t(`photo.filter.${id}` as const)}</button>})}
   </div>
   <span className="tool-divider" aria-hidden="true"/>
   <div role="group" aria-label={t('photo.frames')}>
    {frameIds.map(id=>{const open=looksUnlocked(pages,frameUnlock[id]);return <button key={id} type="button" className="tool-button" aria-pressed={s.frame===id} aria-disabled={open?undefined:true} title={open?undefined:t('photo.locked',{n:frameUnlock[id]})} onClick={()=>s.setFrame(id)}>{t(`photo.frame.${id}` as const)}</button>})}
   </div>
  </div>
  <div className="photo-bar paper-note" role="toolbar" aria-label={t('photo.label')}>
   <div className="photo-lights" role="group" aria-label={t('photo.light')}>
    {lights.map(l=><button key={l} type="button" className="tool-button" aria-pressed={light===l} onClick={()=>s.setLight(l)}>{t(`photo.light.${l}` as const)}</button>)}
   </div>
   <button type="button" className="tool-button" aria-pressed={s.free} title={t('photo.freeHint')} onClick={s.toggleFree}>{t('photo.free')}</button>
   <button type="button" className="tool-button" aria-pressed={s.hideRaccoon} onClick={s.toggleHideRaccoon}>{t('photo.hideRaccoon')}</button>
   <button type="button" className="shutter" aria-label={t('photo.shutter')} title={`${t('photo.shutter')} (Space)`} aria-busy={s.pending} onClick={s.shutter}><Icon name="camera" size={22}/></button>
   <button type="button" className="tool-button icon-only" aria-label={t('photo.close')} title={`${t('photo.close')} (Esc)`} onClick={s.exit}><Icon name="close"/></button>
  </div>
  <p className="ink-note photo-hint">{t(s.free?'photo.hintFree':'photo.hint')}</p>
  {s.last&&<figure className="paper-note photo-last">
   <img src={s.last.url} alt={t('photo.taken')}/>
   <figcaption>{t('photo.taken')}{s.last.saved?` · ${t('photo.savedAlbum')}`:''}</figcaption>
   <a className="tool-button" href={s.last.url} download={s.last.name}>{t('photo.download')}</a>
   <button type="button" className="close-button" onClick={s.dismissLast} aria-label={t('photo.dismiss')}><Icon name="close"/></button>
  </figure>}
 </>
}

/** The menu album: thumbnails of the latest photos, each downloadable or deletable. */
export function AlbumPanel(){
 const t=useT(),lang=useLang(s=>s.lang),version=usePhotoStore(s=>s.albumVersion)
 const [items,setItems]=useState<{record:PhotoRecord;url:string}[]|null>(null)
 const [failed,setFailed]=useState(false),[tick,setTick]=useState(0)
 useEffect(()=>{
  let urls:string[]=[],live=true
  listPhotos().then(records=>{
   const made=records.map(record=>({record,url:URL.createObjectURL(record.thumb)}))
   urls=made.map(m=>m.url)
   if(live)setItems(made);else urls.forEach(u=>URL.revokeObjectURL(u))
  }).catch(()=>{if(live)setFailed(true)})
  return()=>{live=false;urls.forEach(u=>URL.revokeObjectURL(u))}
 },[version,tick])
 if(failed)return <p className="empty">{t('album.unavailable')}</p>
 if(!items)return null
 if(!items.length)return <p className="empty">{t('album.empty')}</p>
 const date=(at:string)=>new Date(at).toLocaleString(lang==='zh'?'zh-CN':'en-GB',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
 const download=(r:PhotoRecord)=>{
  const url=URL.createObjectURL(r.image),a=document.createElement('a')
  a.href=url;a.download=`forest-moments-${r.id.split('-')[0]}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <><p>{t('album.note',{n:albumLimit})}</p><ul className="album-grid">{items.map(({record,url})=><li key={record.id}>
  <img src={url} alt={t('album.photoLabel',{date:date(record.at)})} loading="lazy"/>
  <span>{date(record.at)}</span>
  <div>
   <button type="button" className="tool-button" aria-label={t('album.downloadLabel')} onClick={()=>download(record)}>{t('photo.download')}</button>
   <button type="button" className="tool-button" aria-label={t('album.deleteLabel')} onClick={()=>{void deletePhoto(record.id).finally(()=>setTick(n=>n+1))}}>{t('album.delete')}</button>
  </div>
 </li>)}</ul></>
}
