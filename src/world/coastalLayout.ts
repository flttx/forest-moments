import {creekDistance,creekWaterY,creekZ,reefs} from '../game/expansion'
import {originalCoastRadius as coastRadius,isBeachApproach,oceanNavigation,seaLevel,originalShorelineRadius as shorelineRadius,isDockSurface} from './worldConfig'
import {originalTerrainHeight as terrainHeight,terrainHeight as expandedTerrainHeight} from './terrain'
import {mistIsland,mistHeight,mistPathDistance,mistRadius} from './mistIsland'
import {autumnIsland,autumnHeight,autumnPathDistance,autumnBerth,autumnVista} from './autumnIsland'
import {coastalVegetationPositions as vegetationPositions} from './vegetationLayout'
import {buildTideCoast} from './tideCoastLayout'
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

/** Small overlapping outcrops on the north face, leaving the forest loop and tree roots clear. */
export const mistRidgePieces:CoastPiece[]=(()=>{
 const pieces:CoastPiece[]=[],rand=random(3029)
 for(let x=107;x<=124;x+=1.8)for(let z=-29;z<=-23;z+=1.5){
  const px=x+(rand()-.5)*.7,pz=z+(rand()-.5)*.6,scale=1.1+rand()*.5
  const kit:CoastKit=rand()<.7?'Rock_Slab':'Rock_Boulder',reach=coastKits[kit].half*scale
  if(mistRadius(px,pz)>1.01||mistHeight(px,pz)<.1||mistPathDistance(px,pz)<reach+1.1)continue
  if(vegetationPositions.some(p=>Math.hypot(px-p.x,pz-p.z)<reach+.45))continue
  // Embed the base below the lowest footprint sample; slope controls the exposed rock face.
  const ground=Math.min(...Array.from({length:8},(_,i)=>mistHeight(px+Math.cos(i*Math.PI/4)*reach*.7,pz+Math.sin(i*Math.PI/4)*reach*.7)))
  // The full visible footprint must stay in shallow, non-rowable ground, not just the embedded base.
  if(Array.from({length:16},(_,i)=>mistHeight(px+Math.cos(i*Math.PI/8)*reach,pz+Math.sin(i*Math.PI/8)*reach)).some(h=>h<seaLevel+.1))continue
  pieces.push({kit,x:px,z:pz,y:ground-.12,yaw:rand()*Math.PI*2,scale,role:'cliff'})
 }
 return pieces
})()
/** Broken rock groups on exposed shores; broad sand gaps and the west landing remain open. */
export const mistShorePieces:CoastPiece[]=(()=>{
 const pieces:CoastPiece[]=[],rand=random(291029)
 for(const [angle,count] of [[-2.05,4],[-1.5,5],[-.83,6],[-.08,5],[.62,4],[1.25,3]])for(const level of [.25,1.5,2.8])for(let i=0;i<count;i++){
  const a=angle+(i-(count-1)/2)*.085+(rand()-.5)*.025+(level>.3?.035:0)
  const kit:CoastKit=rand()<.28?'Rock_Slab':'Rock_Boulder',scale=.75+rand()*.55,reach=coastKits[kit].half*scale
  const point=(r:number)=>({x:mistIsland.x+Math.cos(a)*r,z:mistIsland.z+Math.sin(a)*r})
  // Find the shallow shore, then pull the whole footprint inland. Never obstruct rowable water.
  let lo=8,hi=25
  const inner=point(lo);if(mistHeight(inner.x,inner.z)<level)continue
  for(let j=0;j<24;j++){const r=(lo+hi)/2,p=point(r);if(mistHeight(p.x,p.z)>level)lo=r;else hi=r}
  let r=(lo+hi)/2,p=point(r)
  const heights=()=>Array.from({length:32},(_,j)=>mistHeight(p.x+Math.cos(j*Math.PI/16)*reach,p.z+Math.sin(j*Math.PI/16)*reach))
  for(let j=0;j<24&&Math.min(...heights())<seaLevel+.1;j++){r-=.1;p=point(r)}
  if(Math.min(...heights())<seaLevel+.1||mistPathDistance(p.x,p.z)<reach+1.2)continue
  if(vegetationPositions.some(v=>Math.hypot(p.x-v.x,p.z-v.z)<reach+.65))continue
  if([...mistRidgePieces,...pieces].some(v=>Math.hypot(p.x-v.x,p.z-v.z)<(reach+coastKits[v.kit].half*v.scale)*.58))continue
  // Bury most of the module at its centre; the downhill face emerges from the slope.
  const y=mistHeight(p.x,p.z)-coastKits[kit].height*scale*.85
  pieces.push({kit,...p,y,yaw:-a+(rand()-.5)*1.4,scale,role:'cliff'})
 }
 return pieces
})()
/** Low, separated outcrops for the gentler broadleaf island, with an open west landing. */
export const autumnShorePieces:CoastPiece[]=(()=>{
 const pieces:CoastPiece[]=[],rand=random(301030)
 // Unequal groups leave sand between rocky points; the northeast hill gets a second ledge.
 for(const [angle,count] of [[-2.1,3],[-1.35,5],[-.45,4],[.12,4],[.9,3],[1.65,2]])for(const level of [.2,1.65])for(let i=0;i<count;i++){
  const a=angle+(i-(count-1)/2)*.095+(rand()-.5)*.13+(level>1?.07:0)
  const kit:CoastKit=rand()<.12?'Rock_Slab':'Rock_Boulder',scale=.75+rand()*.6,reach=coastKits[kit].half*scale
  const point=(r:number)=>({x:autumnIsland.x+Math.cos(a)*r,z:autumnIsland.z+Math.sin(a)*r})
  let lo=6,hi=27
  const inner=point(lo);if(autumnHeight(inner.x,inner.z)<level)continue
  for(let j=0;j<24;j++){const r=(lo+hi)/2,p=point(r);if(autumnHeight(p.x,p.z)>level)lo=r;else hi=r}
  let r=(lo+hi)/2-.2-rand()*.65,p=point(r)
  const footprint=()=>Array.from({length:32},(_,j)=>autumnHeight(p.x+Math.cos(j*Math.PI/16)*reach,p.z+Math.sin(j*Math.PI/16)*reach))
  for(let j=0;j<30&&Math.min(...footprint())<seaLevel+.1;j++){r-=.1;p=point(r)}
  if(Math.min(...footprint())<seaLevel+.1||autumnPathDistance(p.x,p.z)<reach+1.2)continue
  if(Math.hypot(p.x-autumnBerth.landing.x,p.z-autumnBerth.landing.z)<reach+7||Math.hypot(p.x-autumnVista.x,p.z-autumnVista.z)<reach+3)continue
  if(vegetationPositions.some(v=>Math.hypot(p.x-v.x,p.z-v.z)<reach+1))continue
  if(pieces.some(v=>Math.hypot(p.x-v.x,p.z-v.z)<(reach+coastKits[v.kit].half*v.scale)*.62))continue
  const y=autumnHeight(p.x,p.z)-coastKits[kit].height*scale*(.83+rand()*.22)
  pieces.push({kit,...p,y,yaw:-a+(rand()-.5)*1.8,scale,role:'cliff'})
 }
 return pieces
})()
const tideCoast=buildTideCoast(coastKits)
export const tideShorePieces=tideCoast.shore
export const tidePoolPieces=tideCoast.pools
export const coastPieces:CoastPiece[]=(()=>{const rand=random(20261025);return[...cliffPieces(rand),...creekPieces(rand),...tidelinePieces(rand)].filter(p=>expandedTerrainHeight(p.x,p.z)-terrainHeight(p.x,p.z)<.01).concat(mistRidgePieces,mistShorePieces,autumnShorePieces,tideShorePieces,tidePoolPieces)})()
