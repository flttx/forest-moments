import {useForestStore} from './game/store'
import {useInventoryStore} from './game/inventoryStore'
import {recipeBlock,recipeIds,recipes,type RecipeId} from './game/recipes'
import type {ItemId} from './game/inventory'
import {useDialogFocus} from './useDialogFocus'
import {useT,type Key} from './i18n'
import {Icon} from './Icon'

const close=()=>useForestStore.setState({recipesOpen:false})

/** The bench's pattern book: each piece with what it needs and what the satchel holds. */
export function RecipeCard(){
 const t=useT()
 const open=useForestStore(s=>s.recipesOpen&&s.location==='workshop'&&s.mode==='walking'),book=useForestStore(s=>s.workshopBook)
 const inv=useInventoryStore(s=>s.inv)
 const {ref,trap}=useDialogFocus<HTMLElement>(open)
 if(!open)return null
 const start=(id:RecipeId)=>{
  // Check, then take the materials, then start: the store refuses only states the check already excludes.
  if(recipeBlock(useForestStore.getState().workshopBook,useInventoryStore.getState().inv.items,id))return
  if(useInventoryStore.getState().take(recipes[id].cost))useForestStore.getState().startRecipe(id)
 }
 return <section ref={ref} className="paper-panel recipe-card" role="dialog" aria-modal="true" aria-labelledby="recipe-title" onKeyDown={e=>{trap(e);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}}}>
  <header><h2 id="recipe-title">{t('recipe.title')}</h2><button type="button" className="close-button" onClick={close} aria-label={t('panel.close')}><Icon name="close"/></button></header>
  <ul className="panel-body recipe-list">{recipeIds.map(id=>{const block=recipeBlock(book,inv.items,id)
   return <li key={id}>
    <strong>{t(`recipe.${id}` as Key)}</strong>
    <small>{Object.entries(recipes[id].cost).map(([item,n])=>`${t(`item.${item}` as Key)} ${inv.items[item as ItemId]??0}/${n}`).join(' · ')}</small>
    {block==='made'?<span className="recipe-made">{t('recipe.made')}</span>:<button type="button" disabled={!!block} onClick={()=>start(id)}>{t('recipe.make')}</button>}
   </li>})}</ul>
 </section>
}
