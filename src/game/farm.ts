import colliders from './farm-colliders.json'

export const farmStorageKey='forest-moments:farm:v1'
export const feedSpot={x:8,z:4.2}
export const farmColliders=colliders
export const animalObstacles=[{x:7.1,z:5.7,r:.18},{x:8.5,z:7.1,r:.38}]
/**
 * `fedDay`: day (nights slept) of the last finished meal. `eggDay`: from which day an egg waits by the coop (null when
 * none is owed). `woolDay`: day the sheep was last brushed. Older saves only have meals.
 */
export type FarmBook={version:1;meals:number;fedDay?:number;eggDay?:number|null;woolDay?:number}
const day=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0
export function decodeFarm(raw:string|null):FarmBook{
 try{
  const b=JSON.parse(raw??'null')
  if(b?.version===1&&Number.isSafeInteger(b.meals)&&b.meals>=0){
   const out:FarmBook={version:1,meals:b.meals}
   if(day(b.fedDay))out.fedDay=b.fedDay
   if(day(b.eggDay)||b.eggDay===null)out.eggDay=b.eggDay
   if(day(b.woolDay))out.woolDay=b.woolDay
   return out
  }
 }catch{/* Invalid saves start empty. */}
 return{version:1,meals:0}
}
/** Farm chores after feeding (docs/GAMEPLAY_EXPANSION_PLAN.md §2.3): an egg the morning after, the sheep brushed once a day. */
export const eggSpot={x:6.8,z:7.35}
export const brushSpot={x:9.05,z:5.75}
export const choreSeconds={egg:1.1,wool:2} as const
/** A meal finished today: the sheep can be brushed today, and an egg is owed for tomorrow unless one is already waiting. */
export function afterMeal(book:FarmBook,today:number):FarmBook{
 const waiting=book.eggDay!=null&&book.eggDay<=today
 return{...book,meals:book.meals+1,fedDay:today,eggDay:waiting?book.eggDay:today+1}
}
export const eggReady=(book:FarmBook,today:number)=>book.eggDay!=null&&book.eggDay<=today
export const woolReady=(book:FarmBook,today:number)=>book.fedDay===today&&book.woolDay!==today
export type Animal={id:'hen'|'sheep';x:number;z:number;yaw:number;state:'idle'|'walk'|'eat';eaten:number;wait:number;target:number}
export const animalRoutes={hen:[[7.1,5.7],[8.3,5.7],[8.3,4.9],[7.1,4.9]],sheep:[[8.5,7.1],[9.6,7.1],[9.6,6.3],[8.5,6.3]]} as const
export const mealTargets={hen:{x:9,z:3.95,yaw:-Math.PI/2},sheep:{x:9.7,z:4.43,yaw:0}}
export function createAnimals():Animal[]{return(['hen','sheep'] as const).map(id=>({id,x:animalRoutes[id][0][0],z:animalRoutes[id][0][1],yaw:0,state:'idle',eaten:0,wait:id==='hen'?1:2,target:1}))}
export function farmSpotFree(x:number,z:number,r:number){return x>=4.65+r&&x<=11.35-r&&z>=3.35+r&&z<=8.65-r&&!farmColliders.some(b=>Math.hypot(Math.max(Math.abs(x-b.x)-b.halfX,0),Math.max(Math.abs(z-b.z)-b.halfZ,0))<r)}
/** Fixed safe walking corridors keep the tiny flock away from fixtures. Food is consumed only at its actual destination. */
export function stepAnimal(a:Animal,delta:number,meal:boolean,player:{x:number;z:number}):Animal{
 if(!Number.isFinite(delta)||delta<=0)return a
 const dt=Math.min(delta,.05),next={...a},destination=meal?mealTargets[a.id]:{x:animalRoutes[a.id][a.target][0],z:animalRoutes[a.id][a.target][1]},radius=a.id==='sheep'?.28:.14
 if(meal&&a.eaten>=5)return{...next,state:'idle'}
 const dx=destination.x-a.x,dz=destination.z-a.z,d=Math.hypot(dx,dz)
 if(d<.025){
  if(meal){next.yaw=mealTargets[a.id].yaw;next.state='eat';next.eaten=Math.min(5,a.eaten+dt)}
  else if(a.wait>0){next.wait-=dt;next.state='idle'}
  else{next.target=(a.target+1)%4;next.wait=2.5;next.state='idle'}
  return next
 }
 const step=Math.min(d,(a.id==='sheep'?.34:.42)*dt),x=a.x+dx/d*step,z=a.z+dz/d*step
 // Yield to the player; no teleporting through them to complete a meal.
 if(Math.hypot(x-player.x,z-player.z)<radius+.32||!farmSpotFree(x,z,radius)){next.state='idle';return next}
 next.x=x;next.z=z;next.state='walk'
 const yaw=Math.atan2(-dx,-dz),difference=yaw-a.yaw
 next.yaw+=Math.atan2(Math.sin(difference),Math.cos(difference))*(1-Math.exp(-9*dt))
 return next
}
