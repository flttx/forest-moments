import {useRef,useState,type KeyboardEvent} from 'react'
import {useLang,useT,type Key} from './i18n'
import {useForestStore} from './game/store'
import {useInventoryStore} from './game/inventoryStore'
import {itemIds} from './game/inventory'
import {bestLight,species,speciesIds} from './game/fishSpecies'
import {secretIds} from './game/secrets'

const tabs=[['fish','catalog.fish'],['satchel','catalog.satchel'],['secrets','catalog.secrets']] as const
type Tab=typeof tabs[number][0]

/** Every kind of fish: found ones with their tally, the rest as a silhouette and when they might bite. */
function FishPage(){
 const t=useT(),lang=useLang(s=>s.lang)
 const book=useForestStore(s=>s.fishBook)
 const found=speciesIds.filter(id=>book.kinds[id])
 return <>
  <p>{t('fish.found',{n:found.length,total:speciesIds.length})}</p>
  <ul className="species-list">{speciesIds.map(id=>{const k=book.kinds[id];const hint=bestLight(id),when=species[id].weather?t('fish.inMist'):(species[id].site==='sea'?t('fish.atSea')+' · ':'')+t(hint.only?'fish.only':'fish.mostly',{light:t(`light.${hint.light}`)})
   return <li key={id} className={k?'found':'unknown'}><span className={`species-swatch swatch-${id}`} aria-hidden="true"/><strong>{k?t(`fish.${id}`):t('fish.unknown')}</strong><small>{k?t('fish.tally',{count:k.count,best:k.bestCm}):when}</small></li>})}</ul>
  {book.count>0&&<ol className="catch-list">{book.recent.slice(0,8).map((fish,i)=><li key={`${fish.at}-${i}`}>{t(`fish.${fish.species??'koi'}`)} · {fish.sizeCm} cm · {new Date(fish.at).toLocaleDateString(lang==='zh'?'zh-CN':'en-GB')}</li>)}</ol>}
 </>
}

/** What the raccoon carries: only things found so far are listed, with how many are in hand. */
function SatchelPage(){
 const t=useT(),inv=useInventoryStore(s=>s.inv)
 const found=itemIds.filter(id=>inv.found.includes(id))
 if(!found.length)return <p className="empty">{t('catalog.satchelEmpty')}</p>
 return <ul className="satchel-list">{found.map(id=><li key={id}><span>{t(`item.${id}` as Key)}</span><span className="satchel-count">× {inv.items[id]??0}</span></li>)}</ul>
}

/** Hidden corners: found ones with when; the rest as a hint, never a map marker. */
function SecretsPage(){
 const t=useT(),lang=useLang(s=>s.lang),found=useForestStore(s=>s.secretsBook.found)
 return <ul className="species-list">{secretIds.map(id=>{const at=found[id]
  return <li key={id} className={at?'found':'unknown'}><span className="species-swatch secret-swatch" aria-hidden="true"/><strong>{at?t(`secret.${id}`):t('fish.unknown')}</strong><small>{at?new Date(at).toLocaleDateString(lang==='zh'?'zh-CN':'en-GB'):t(`secret.${id}.hint`)}</small></li>})}</ul>
}

/** The field guide: one tab per kind of find; arrow keys move between tabs. */
export function CatalogPanel(){
 const t=useT(),[tab,setTab]=useState<Tab>('fish'),refs=useRef<(HTMLButtonElement|null)[]>([])
 const move=(e:KeyboardEvent)=>{
  if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return
  e.preventDefault();const i=tabs.findIndex(([id])=>id===tab),next=(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length
  setTab(tabs[next][0]);refs.current[next]?.focus()
 }
 return <div className="catalog">
  <div className="catalog-tabs" role="tablist" aria-label={t('menu.fishbook')} onKeyDown={move}>
   {tabs.map(([id,label],i)=><button key={id} ref={el=>{refs.current[i]=el}} type="button" role="tab" id={`catalog-tab-${id}`} aria-selected={tab===id} aria-controls="catalog-page" tabIndex={tab===id?0:-1} className="tool-button" onClick={()=>setTab(id)}>{t(label)}</button>)}
  </div>
  <div id="catalog-page" role="tabpanel" aria-labelledby={`catalog-tab-${tab}`}>{tab==='fish'?<FishPage/>:tab==='satchel'?<SatchelPage/>:<SecretsPage/>}</div>
 </div>
}
