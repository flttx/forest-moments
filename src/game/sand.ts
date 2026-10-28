import {terrainHeight} from '../world/terrain'
import {seaLevel} from '../world/worldConfig'
import {canStandAt} from './movement'

/**
 * Sand play on the big south beach (docs/BEACH_SANDPLAY_PLAN.md): castles, a channel to the sea, pits and a raccoon print
 * pressed into deformable sand, plus paw prints that fade. Pure: shapes, placement, saving and the stride clock.
 */
/** The deformable patch; its edges sit on the 30 cm terrain grid so the refined mesh meets the rest watertight. */
export const sandRect={minX:-14.1,maxX:14.1,minZ:23.4,maxZ:39.6} as const
/** 3 cm texels: a paw print's palm and toes still read in the shading over the whole crescent. */
export const sandTexel=.03
export const sandSize={w:Math.round((sandRect.maxX-sandRect.minX)/sandTexel),h:Math.round((sandRect.maxZ-sandRect.minZ)/sandTexel)}
export const sandKinds=['castle','river','pit','imprint'] as const
export type SandKind=typeof sandKinds[number]
export interface SandWork{kind:SandKind;x:number;z:number;yaw:number}
export interface SandBook{version:1;day:number;works:SandWork[]}
export const sandStorageKey='forest-moments:sand:v1'
export const maxWorks=12
export const buildSeconds=3
/** How far ahead of the raccoon the outline sits, by kind. */
export const reachAhead:Record<SandKind,number>={castle:1.25,river:.9,pit:1.2,imprint:1.1}
export type SandRefusal='outside'|'blocked'|'water'|'overlap'|'full'|'far'

const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)}
const segment=(px:number,pz:number,ax:number,az:number,bx:number,bz:number)=>{
 const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz||1)))
 return{d:Math.hypot(px-ax-dx*t,pz-az-dz*t),t}
}

export function inSandRect(x:number,z:number,margin=0){
 return x>=sandRect.minX+margin&&x<=sandRect.maxX-margin&&z>=sandRect.minZ+margin&&z<=sandRect.maxZ-margin
}
/** Driftwood, rocks, trees and lamps: the centre and four points round the rim must all be clear. */
const clearOf=(c:{x:number;z:number;r:number})=>[[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(([u,v])=>canStandAt(c.x+u*c.r*.8,c.z+v*c.r*.8))
/** Straight out to sea from the island's middle. */
const seaward=(w:{x:number;z:number})=>{const l=Math.hypot(w.x,w.z)||1;return{x:w.x/l,z:w.z/l}}
/** How far seaward from a point the wet sand meets the water (just above it). */
export function tidelineDistance(w:{x:number;z:number}){
 const d=seaward(w);let lo=0,hi=12
 for(let i=0;i<24;i++){const m=(lo+hi)/2;if(terrainHeight(w.x+d.x*m,w.z+d.z*m)>seaLevel+.05)lo=m;else hi=m}
 return(lo+hi)/2
}

/** A channel from the dug end down to the tide line, with a gentle bend; the sea runs in along it. */
const riverPaths=new Map<string,{x:number;z:number}[]>()
/** The channel's path is fixed by where it starts; it is asked for once per texel while drawing, so keep it. */
export function riverPath(w:Pick<SandWork,'x'|'z'>):{x:number;z:number}[]{
 const key=`${w.x},${w.z}`,known=riverPaths.get(key)
 if(known)return known
 if(riverPaths.size>64)riverPaths.clear()
 const d=seaward(w),length=tidelineDistance(w)+.25,n=12,phase=(w.x*3.1+w.z*1.7)%6.28
 const path=Array.from({length:n+1},(_,i)=>{const t=i/n,bend=Math.sin(t*Math.PI*1.6+phase)*.28*Math.sin(t*Math.PI);return{x:w.x+d.x*length*t-d.z*bend,z:w.z+d.z*length*t+d.x*bend}})
 riverPaths.set(key,path)
 return path
}
/** The ground a work can change, as a box: a channel hugs its path instead of filling a circle round its start. */
export function workBounds(w:SandWork){
 if(w.kind!=='river'){const r=workExtent(w);return{minX:w.x-r,maxX:w.x+r,minZ:w.z-r,maxZ:w.z+r}}
 const p=riverPath(w),xs=p.map(q=>q.x),zs=p.map(q=>q.z)
 return{minX:Math.min(...xs)-.45,maxX:Math.max(...xs)+.45,minZ:Math.min(...zs)-.45,maxZ:Math.max(...zs)+.45}
}

/** Local frame: u to the print's right, v toward its head. */
const toLocal=(w:SandWork,x:number,z:number)=>{const dx=x-w.x,dz=z-w.z,s=Math.sin(w.yaw),c=Math.cos(w.yaw);return{u:dx*c-dz*s,v:-dx*s-dz*c}}
const circle=(u:number,v:number,cu:number,cv:number,r:number)=>Math.hypot(u-cu,v-cv)-r
const capsule=(u:number,v:number,au:number,av:number,bu:number,bv:number,r:number)=>segment(u,v,au,av,bu,bv).d-r
const ellipse=(u:number,v:number,cu:number,cv:number,ru:number,rv:number)=>{const k=Math.hypot((u-cu)/ru,(v-cv)/rv);return(k-1)*Math.min(ru,rv)}
// The tail curls off to one side in three segments, ringed like the real one.
const tail=[[0,-.26],[.08,-.5],[.2,-.68],[.36,-.76]] as const
/** Signed distance (m) to a raccoon lying face down, seen from above: ears, masked head, limbs and a ringed tail. */
export function raccoonOutline(u:number,v:number){
 let d=Math.min(circle(u,v,0,.36,.15),ellipse(u,v,0,.52,.07,.07),circle(u,v,-.11,.48,.055),circle(u,v,.11,.48,.055),ellipse(u,v,0,0,.19,.27))
 for(const s of [-1,1])d=Math.min(d,capsule(u,v,s*.14,.14,s*.33,.3,.05),capsule(u,v,s*.12,-.2,s*.27,-.38,.055))
 for(let i=0;i<tail.length-1;i++)d=Math.min(d,capsule(u,v,tail[i][0],tail[i][1],tail[i+1][0],tail[i+1][1],.075-i*.008))
 return d
}
/** 0..1 along the tail for points on it, else -1; the print presses its rings a little deeper. */
function tailRing(u:number,v:number){
 let best=Infinity,along=-1,run=0
 for(let i=0;i<tail.length-1;i++){
  const a=tail[i],b=tail[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),{d,t}=segment(u,v,a[0],a[1],b[0],b[1])
  if(d<best){best=d;along=run+t*len}
  run+=len
 }
 return best<.09?along:-1
}

/** Height change (m) one finished work makes at a point; `amount` 0..1 while it is still being built. */
export function workHeight(w:SandWork,x:number,z:number,amount=1){
 if(amount<=0)return 0
 if(w.kind==='castle'){const r=Math.hypot(x-w.x,z-w.z);return r<.95?.07*(1-smooth(.55,.95,r))*amount:0}
 if(w.kind==='pit'){
  const r=Math.hypot(x-w.x,z-w.z)
  if(r<.55)return-.32*(1-(r/.55)**2)*amount
  return r<.88?.075*Math.sin(Math.PI*(r-.55)/.33)*amount:0
 }
 if(w.kind==='river'){
  const path=riverPath(w);let d=Infinity
  for(let i=0;i<path.length-1;i++)d=Math.min(d,segment(x,z,path[i].x,path[i].z,path[i+1].x,path[i+1].z).d)
  // The channel is dug from the inland end outward, so it lengthens toward the sea as it is built.
  const reach=Math.hypot(x-w.x,z-w.z)/Math.max(.01,Math.hypot(path.at(-1)!.x-w.x,path.at(-1)!.z-w.z))
  const grown=1-smooth(amount-.08,amount+.02,reach)
  if(d<.2)return-.14*(1-(d/.2)**2)*grown
  return d<.36?.035*Math.sin(Math.PI*(d-.2)/.16)*grown:0
 }
 const {u,v}=toLocal(w,x,z),s=raccoonOutline(u,v)
 if(s>.045)return 0
 if(s>0)return .016*Math.sin(Math.PI*s/.045)*amount
 const ring=tailRing(u,v),stripe=ring>=0&&Math.floor(ring/.075)%2===1?.025:0
 return-(.05+stripe)*smooth(0,-.025,s)*amount
}
/** Bounding radius about the work's centre, for rasterising and cheap rejection. */
export function workExtent(w:SandWork){
 if(w.kind==='river'){const p=riverPath(w),e=p.at(-1)!;return Math.hypot(e.x-w.x,e.z-w.z)+.45}
 return w.kind==='castle'?.95:w.kind==='pit'?.9:.95
}
/** Ground offset at a point from every work (with per-index build amounts while one is going up). */
export function sandOffsetAt(works:readonly SandWork[],x:number,z:number,amounts?:readonly number[]){
 if(!inSandRect(x,z))return 0
 let h=0
 for(let i=0;i<works.length;i++){const w=works[i];if(Math.hypot(x-w.x,z-w.z)<workExtent(w))h+=workHeight(w,x,z,amounts?.[i]??1)}
 return h
}

/** Footprint circles used for overlap and the jetty check. */
export function workCircles(w:SandWork):{x:number;z:number;r:number}[]{
 if(w.kind==='river')return riverPath(w).filter((_,i)=>i%2===0).map(p=>({x:p.x,z:p.z,r:.36}))
 if(w.kind==='imprint'){const s=Math.sin(w.yaw),c=Math.cos(w.yaw);return[[0,.4,.3],[0,0,.36],[.2,-.6,.3]].map(([u,v,r])=>({x:w.x+u*c-v*s,z:w.z-u*s-v*c,r}))}
 return[{x:w.x,z:w.z,r:w.kind==='castle'?.85:.88}]
}
/** Solid parts the raccoon walks around: only castles. */
export function sandObstacles(works:readonly SandWork[]){return works.filter(w=>w.kind==='castle').map(w=>({x:w.x,z:w.z,r:.72}))}

/** Why a work cannot go here, or null when it can. */
export function placementRefusal(w:SandWork,works:readonly SandWork[]):SandRefusal|null{
 if(works.length>=maxWorks)return 'full'
 const circles=workCircles(w)
 if(!circles.every(c=>inSandRect(c.x,c.z,c.r)))return 'outside'
 if(w.kind==='river'){
  const length=tidelineDistance(w)
  if(terrainHeight(w.x,w.z)<seaLevel+.35)return 'water'
  if(length>5.5)return 'far'
 }
 else if(circles.some(c=>terrainHeight(c.x,c.z)<seaLevel+.3))return 'water'
 // The channel's own sea end runs into the water; everything else needs clear sand.
 if(!(w.kind==='river'?circles.slice(0,-1):circles).every(clearOf))return 'blocked'
 const others=works.flatMap(workCircles)
 return circles.some(c=>others.some(o=>Math.hypot(c.x-o.x,c.z-o.z)<c.r+o.r))?'overlap':null
}

export const emptySand=(day:number):SandBook=>({version:1,day,works:[]})
/** Today's works; another day's (or a broken save) is a smoothed beach, as the tide left it. */
export function decodeSand(raw:string|null,day:number):SandBook{
 try{
  const v=raw?JSON.parse(raw) as unknown:null
  if(!v||typeof v!=='object')return emptySand(day)
  const b=v as Partial<SandBook>
  if(b.version!==1||b.day!==day||!Array.isArray(b.works))return emptySand(day)
  const works=b.works.filter((w):w is SandWork=>!!w&&typeof w==='object'&&sandKinds.includes((w as SandWork).kind)&&[w.x,w.z,w.yaw].every(Number.isFinite)&&inSandRect(w.x,w.z)).slice(0,maxWorks)
  return{version:1,day,works}
 }catch{return emptySand(day)}
}

/** Paw prints: left and right in turn, a stride apart, a little either side of the path. */
export interface Stride{travelled:number;left:boolean}
export const strideLength={walk:.2,run:.36} as const
export const printLifetime=40
/** Advance the stride clock by a step; returns the print to press, if this step completes a stride. */
export function stepStride(s:Stride,from:{x:number;z:number},to:{x:number;z:number},running:boolean):{stride:Stride;print:{x:number;z:number;yaw:number;left:boolean}|null}{
 const moved=Math.hypot(to.x-from.x,to.z-from.z)
 if(!Number.isFinite(moved)||moved<1e-5)return{stride:s,print:null}
 const travelled=s.travelled+moved,length=running?strideLength.run:strideLength.walk
 if(travelled<length)return{stride:{...s,travelled},print:null}
 const yaw=Math.atan2(to.x-from.x,to.z-from.z),side=s.left?-.1:.1
 return{stride:{travelled:travelled%length,left:!s.left},print:{x:to.x+Math.cos(yaw)*side,z:to.z-Math.sin(yaw)*side,yaw,left:s.left}}
}
/** Depth (m) a paw presses at a point in the print's own frame: a palm and five toes, like a small hand. */
export function pawDepth(u:number,v:number,left:boolean){
 const m=left?-u:u
 let d=Math.max(0,1-Math.hypot(m/.056,(v+.011)/.07))*.024
 for(let i=0;i<5;i++){const a=(i-2)*.42+.08,tu=Math.sin(a)*.104,tv=Math.cos(a)*.104;d=Math.max(d,Math.max(0,1-Math.hypot(m-tu,v-tv)/.027)*.02)}
 return d
}
