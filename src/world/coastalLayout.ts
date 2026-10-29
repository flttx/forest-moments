import {creekDistance,creekWaterY,creekZ,reefs} from '../game/expansion'
import {originalCoastRadius as coastRadius,isBeachApproach,oceanNavigation,seaLevel,originalShorelineRadius as shorelineRadius,isDockSurface} from './worldConfig'
import {originalTerrainHeight as terrainHeight,terrainHeight as expandedTerrainHeight} from './terrain'
const seaRangeRadius=(a:number)=>shorelineRadius(a)+oceanNavigation.offshoreLimit

export type CoastKit='Rock_Slab'|'Rock_Tall'|'Rock_Boulder'|'Rock_Cobbles'|'Driftwood_Long'|'Driftwood_Short'
export interface CoastPiece{kit:CoastKit;x:number;y:number;z:number;yaw:number;scale:number;role:'cliff'|'creek'|'tideline'}
/** Measured from scripts/build_coastal_kit.py output: height and horizontal half-extent at scale 1, metres. */
export const coastKits:Record<CoastKit,{height:number;half:number}>={
 Rock_Slab:{height:1.67,half:1.23},Rock_Tall:{height:2.92,half:.88},Rock_Boulder:{height:1.28,half:.95},
 Rock_Cobbles:{height:.47,half:.74},Driftwood_Long:{height:.4,half:1.2},Driftwood_Short:{height:.25,half:.7},
}

// Sea the boat may use: same rule as rowing.isNavigableSea, kept here to avoid importing the game loop.
const navigable=(x:number,z:number)=>Math.hypot(x,z)<=seaRangeRadius(Math.atan2(z,x))&&terrainHeight(x,z)<=seaLevel-oceanNavigation.minDepth
const nearReef=(x:number,z:number,r:number)=>reefs.some(f=>Math.hypot(x-f.x,z-f.z)<2.6*f.scale+r)
const terrainSlope=(x:number,z:number)=>Math.hypot(terrainHeight(x+.15,z)-terrainHeight(x-.15,z),terrainHeight(x,z+.15)-terrainHeight(x,z-.15))/.3
function random(seed:number){let s=seed;return()=>{s=s*16807%2147483647;return s/2147483647}}

/** Radius along a ray from the island centre where the ground falls through height y (ground falls outward). */
function radiusAtHeight(angle:number,y:number,inner:number,outer:number){
 const c=Math.cos(angle),s=Math.sin(angle);let lo=inner,hi=outer
 for(let i=0;i<24;i++){const r=(lo+hi)/2;if(terrainHeight(c*r,s*r)>y)lo=r;else hi=r}
 return(lo+hi)/2
}
/** Footprint samples around a piece: none may overlap water the boat can reach (the creek mouth opens sideways, not only seaward). */
export function seawardClear(p:CoastPiece){
 const half=coastKits[p.kit].half*p.scale*.75
 return!navigable(p.x,p.z)&&Array.from({length:8},(_,i)=>i*Math.PI/4).every(b=>!navigable(p.x+Math.cos(b)*half,p.z+Math.sin(b)*half))
}
function pullInland(p:CoastPiece){
 const a=Math.atan2(p.z,p.x)
 for(let i=0;i<30&&!seawardClear(p);i++){p.x-=Math.cos(a)*.15;p.z-=Math.sin(a)*.15}
 return p
}

/** Rock courses over every steep sea cliff, sized to the local drop; alternate courses are offset like masonry so no wall shows through. */
function cliffPieces(rand:()=>number){
 const pieces:CoastPiece[]=[],step=.04
 for(let a=0;a<Math.PI*2;a+=step){
  const crest=coastRadius(a)-2.8,cx=Math.cos(a)*crest,cz=Math.sin(a)*crest,top=terrainHeight(cx,cz)
  if(top<1.6||isBeachApproach(cx,cz)||creekDistance(cx,cz)<2.2)continue
  const shore=shorelineRadius(a),drop=top-seaLevel,rows=Math.max(1,Math.round(drop/1.7))
  for(let k=0;k<rows;k++){
   const crown=k===rows-1,target=seaLevel+drop*Math.min(.86,(k+.5)/rows)
   // Tall stacks only as occasional buttresses at the foot; slabs carry the face.
   const kit:CoastKit=crown?(rand()<.6?'Rock_Slab':'Rock_Boulder'):k===0&&drop>5&&rand()<.3?'Rock_Tall':rand()<.75?'Rock_Slab':'Rock_Boulder'
   const scale=Math.min(1.7,Math.max(.9,drop/rows/coastKits[kit].height*(1.15+rand()*.3)))
   const b=a+(k%2?step/2:0)+(rand()-.5)*.02,r=radiusAtHeight(b,target,crest-1,shore+1)+.35
   const piece=pullInland({kit,x:Math.cos(b)*r,y:target-coastKits[kit].height*scale*.55,z:Math.sin(b)*r,yaw:rand()*Math.PI*2,scale,role:'cliff'})
   // Low courses near the mouth slide down toward the creek; the creek walls get their own pieces.
   if(creekDistance(piece.x,piece.z)>=1.5)pieces.push(piece)
  }
 }
 return pieces
}

/** The creek cuts a gorge to the sea: line both walls with boulders stepping up the face, fitted across the gorge rather than toward the island centre. */
function creekPieces(rand:()=>number){
 const pieces:CoastPiece[]=[]
 for(let x=-40;x<=-19;x+=1.25)for(const side of [-1,1]){
  const cz=creekZ(x),water=creekWaterY(x),top=Math.max(...[2,3,4,5,6,7].map(d=>terrainHeight(x,cz+side*d))),drop=top-water
  if(drop<1)continue
  const rows=Math.max(1,Math.round(drop/1.8))
  for(let k=0;k<rows;k++){
   const kit:CoastKit=k===0?'Rock_Boulder':rand()<.5?'Rock_Slab':'Rock_Boulder'
   const scale=Math.min(1.4,Math.max(.55,drop/rows/coastKits[kit].height*(1+rand()*.3)))
   const target=water+drop*Math.min(.85,(k+.35)/rows)
   // Walk out from the creek bed to where the wall first passes the row height (the headland falls away again behind it), then sit the rock slightly into it.
   let lo=1.3;while(lo<7&&terrainHeight(x,cz+side*lo)<target)lo+=.1
   if(lo>=7)continue
   const piece:CoastPiece={kit,x:x+(rand()-.5)*.4,y:target-coastKits[kit].height*scale*.5,z:cz+side*(lo+.25),yaw:rand()*Math.PI*2,scale,role:'creek'}
   for(let i=0;i<10&&!seawardClear(piece);i++)piece.z+=side*.15
   if(seawardClear(piece)&&terrainSlope(piece.x,piece.z)>.85)pieces.push(piece)
  }
 }
 return pieces
}

/** Cobbles and driftwood in the wash: too low to stand on, too shallow to row through. */
function tidelinePieces(rand:()=>number){
 const pieces:CoastPiece[]=[]
 for(let i=0;i<100;i++){
  const a=i*2.39996+rand()*.2,shore=shorelineRadius(a)
  const r=radiusAtHeight(a,seaLevel+.05,shore-6,shore+1),x=Math.cos(a)*r,z=Math.sin(a)*r
  if(isBeachApproach(x,z)||isDockSurface(x,z,-2)||creekDistance(x,z)<3||nearReef(x,z,.5))continue
  const wood=i%7===3,kit:CoastKit=wood?(i%2?'Driftwood_Long':'Driftwood_Short'):i%3===0?'Rock_Boulder':'Rock_Cobbles'
  const scale=wood?.85+rand()*.3:kit==='Rock_Boulder'?.32+rand()*.25:.55+rand()*.45
  // Driftwood lies along the shore; stones keep a random turn.
  const yaw=wood?-a+Math.PI/2+(rand()-.5)*.6:rand()*Math.PI*2
  const piece=pullInland({kit,x,y:0,z,yaw,scale,role:'tideline'})
  // Pulled up onto walkable sand: skip rather than add an obstacle the raccoon would clip through.
  if(terrainHeight(piece.x,piece.z)>=seaLevel+.16)continue
  piece.y=terrainHeight(piece.x,piece.z)-coastKits[kit].height*scale*(wood?.35:.45)
  pieces.push(piece)
 }
 return pieces
}

export const coastPieces:CoastPiece[]=(()=>{const rand=random(20261025);return[...cliffPieces(rand),...creekPieces(rand),...tidelinePieces(rand)].filter(p=>expandedTerrainHeight(p.x,p.z)-terrainHeight(p.x,p.z)<.01)})()
