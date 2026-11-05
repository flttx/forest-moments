import {extendWestLand,westCoastRadius,westCoveHeight,westCove} from './westExpansion'
import {tideHeight,tideBerth} from './tideIsland'
import {mistHeight} from './mistIsland'
import {autumnHeight,autumnBerth} from './autumnIsland'
/** Shared world-space contracts: rendering, navigation, interaction and QA use these coordinates. */
export const seaLevel=-.85
export const islandShape={coastRadius:41,walkRadius:35,plateauRadius:35.5,meshSize:96,shoreDepth:2.3,shoreExtension:1.8,loopRadius:19.5} as const
export const workshopPosition=[-12,0,8] as const
/** On the north cliff top, open to the sea; turned half round (`lookoutYaw`) so its stairs face inland. */
export const lookoutPosition=[11.5,7.8,-31.5] as const
export const lookoutYaw=Math.PI
/** The hilltop where the lookout first stood; it stays a treeless knoll so the seeded groves keep their places. */
export const lookoutHill={x:13,z:-26} as const
export const pond={x:6,z:-5,radius:4.05,waterY:-.08} as const
/** V4 meadow clearings: no trees inside `r`, grass and flowers gather here; two of them open toward the sea corridors. */
export const clearings=[{x:-20,z:19,r:5.5},{x:26,z:14,r:5},{x:-8,z:-4,r:4.5}] as const
export function meadowWeight(x:number,z:number){
 let m=0
 for(const c of clearings)m=Math.max(m,1-smoothRange(Math.hypot(x-c.x,z-c.z),c.r*.55,c.r*1.25))
 return m
}
export const coastalDock={minX:35,maxX:44.2,minZ:-1.1,maxZ:1.1,deckY:.12} as const
export const landing={x:42.6,z:.8} as const
export const mooring={x:42.6,z:2.15,heading:0} as const
export const berths={
 main:{id:'main',landing,mooring,dock:coastalDock},
 mist:{id:'mist',landing:{x:80.6,z:-10.8},mooring:{x:80.6,z:-12.15,heading:Math.PI},dock:{minX:79,maxX:88.2,minZ:-11.1,maxZ:-8.9,deckY:.12}},
 autumn:autumnBerth,
 tide:tideBerth,
} as const
export type BerthId=keyof typeof berths
export function dockAt(x:number,z:number,inset=0){return Object.values(berths).find(({dock:d})=>x>=d.minX+inset&&x<=d.maxX-inset&&z>=d.minZ+inset&&z<=d.maxZ-inset)}
export const oceanNavigation={offshoreLimit:12,minDepth:.22} as const
export const dockPosts=Object.values(berths).flatMap(({dock:d})=>[d.minX+.4,d.maxX-.4].flatMap(x=>[d.minZ+.24,d.maxZ-.24].map(z=>({x,z,r:.2}))))

/**
 * Points and coves round the main island's shore, kept clear of the dock, the play sand, the camp and the reefs:
 * [bearing (rad), half-width (rad), coast shift (m), plateau shift (m)]. A point pushes both out (a grassy spur with a
 * narrow beach); a cove pulls the waterline in more than the turf, leaving a deeper crescent of sand.
 */
export const shoreFeatures=[[-.85,.2,-1.6,-.6],[.42,.13,1.7,1.5]] as const
const bearingGap=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
const featureShift=(angle:number,column:2|3)=>shoreFeatures.reduce((sum,f)=>sum+f[column]*Math.exp(-((bearingGap(angle,f[0])/f[1])**2)),0)
/** Where the beach may change width: everywhere except the dock approach and the play sand to the south. */
const freeShore=(angle:number)=>(1-Math.exp(-((bearingGap(angle,0)/.32)**2)))*(1-Math.exp(-((bearingGap(angle,1.57)/.42)**2)))
/** Inner edge of the beach: wanders in and out so the sand belt is wide in places and a thin strip in others. */
const exactPlateau=(angle:number)=>islandShape.plateauRadius+(1.3*Math.sin(angle*4+1.1)+.7*Math.sin(angle*7-.4))*freeShore(angle)+featureShift(angle,3)
const exactCoast=(angle:number)=>islandShape.coastRadius+.85*Math.sin(angle*3+.4)+.55*Math.sin(angle*5-.8)+.25*Math.cos(angle*9)+.45*Math.sin(angle*11+.6)*freeShore(angle)+featureShift(angle,2)
/** Both radii are smooth in the bearing, so a 2048-step table (millimetre error) stands in for the sums of sines. */
// Bearings arrive in any range (the coast layout walks 0..2π), so wrap before indexing.
const radiusTable=(f:(a:number)=>number)=>{const n=2048,t=new Float64Array(n+1);for(let i=0;i<=n;i++)t[i]=f(-Math.PI+2*Math.PI*i/n);return(a:number)=>{const turn=2*Math.PI,u=((((a+Math.PI)%turn)+turn)%turn)/turn*n,i=Math.min(n-1,Math.floor(u)),f=u-i;return t[i]+(t[i+1]-t[i])*f}}
export const plateauRadiusAt=radiusTable(exactPlateau)
export const originalCoastRadius=radiusTable(exactCoast)
/** The same shore in GLSL, for the sand, the foam line and the water's edge. */
export const shoreGLSL=/* glsl */`
float bearingGap(float a,float b){return atan(sin(a-b),cos(a-b));}
float freeShore(float a){return (1.0-exp(-pow(bearingGap(a,0.0)/.32,2.0)))*(1.0-exp(-pow(bearingGap(a,1.57)/.42,2.0)));}
float featureShift(float a,int column){float s=0.0;
${shoreFeatures.map(([b,w,c,p])=>` s+=(column==2?${c.toFixed(2)}:${p.toFixed(2)})*exp(-pow(bearingGap(a,${b.toFixed(3)})/${w.toFixed(3)},2.0));`).join('\n')}
 return s;}
float plateauAt(vec2 p){float a=atan(p.y,p.x);return ${islandShape.plateauRadius.toFixed(1)}+(1.3*sin(a*4.0+1.1)+.7*sin(a*7.0-.4))*freeShore(a)+featureShift(a,3);}
float coastAt(vec2 p){float a=atan(p.y,p.x);return ${islandShape.coastRadius.toFixed(1)}+.85*sin(a*3.0+.4)+.55*sin(a*5.0-.8)+.25*cos(a*9.0)+.45*sin(a*11.0+.6)*freeShore(a)+featureShift(a,2);}
`
export function coastRadius(angle:number){return Math.max(originalCoastRadius(angle),westCoastRadius(angle),bayCoastBound(angle))}
/** Far edge of the cove sand along a bearing (a generous bound for the shoreline search only). */
function bayCoastBound(angle:number){const [bx,bz]=westCove.b,d=Math.hypot(bx,bz),gap=Math.abs(bearingGap(angle,Math.atan2(bz,bx)));return gap<.45?d+westCove.halfWidth*1.3:0}
let low=0,high=1
for(let i=0;i<30;i++){const t=(low+high)/2;if(t*t*(3-2*t)<-seaLevel/islandShape.shoreDepth)low=t;else high=t}
export const shoreWaterFraction=(low+high)/2
export function smoothRange(v:number,a:number,b:number){const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)}
function hillside(x:number,z:number){
 let hill=7.8*smoothRange(-z,7,26)+3.5*smoothRange(-x,15,30)*smoothRange(-z,-8,18)
 for(const [px,pz,height,inner,outer] of [[-15,-28,7.3,5.3,9],[13,-26,7.8,4,8],[-14,-19.97089946,6.2,4,7]]){
  const blend=1-smoothRange(Math.hypot(x-px,z-pz),inner,outer);hill=hill*(1-blend)+height*blend
 }
 // A broad, walkable ramp meets the bridge's southern landing instead of a steep pad edge.
 const approach=(1-smoothRange(Math.abs(x+14),1.5,8))*smoothRange(z,-18,-16)
 return hill*(1-approach)+6.2*smoothRange(-z,1,17)*approach
}
/**
 * Places that need their ground and their path ends exactly where they are (buildings, pens, plots, the pond, the
 * dock, seats, finds, the play sand): [x, z, radius]. Relief and path bending fade out over 4 m around each.
 */
export const quietSites=[[-12,8,7.5],[8,5.5,6.5],[6,-5,8],[-15,-28,7],[-14,-20,5.5],[11.5,-31.5,5.5],[13,-26,4.5],[20,23,6.5],[38,0,9],[0,31.5,10],[0,0,3.5],[0,8,3],[-10,14.5,3],[12,11,3],[26,14,3],[4,-26,3],[-29,-2.5,3],[1.5,-5,2.5],[14.1,-18.1,3],[27.4,15.6,3],[-29,-10,3],[29,-12,3],[-11.3,-18.1,3]] as const
/** 1 in open country, 0 at the quiet sites, the beach, the creek gorge and the west lobe. */
let openMemo={x:NaN,z:NaN,v:0}
export function openGround(x:number,z:number){
 if(x===openMemo.x&&z===openMemo.z)return openMemo.v
 let q=x<-30?0:1
 const r=Math.hypot(x,z),plateau=q?plateauRadiusAt(Math.atan2(z,x)):0
 if(q&&r>plateau-3)q=0
 // Sites further than their fade band leave q untouched; skip them on a squared distance before any square root.
 for(let i=0;q>0&&i<quietSites.length;i++){const [sx,sz,sr]=quietSites[i],dx=x-sx,dz=z-sz,d2=dx*dx+dz*dz;if(d2<(sr+4)*(sr+4))q*=smoothRange(Math.sqrt(d2),sr,sr+4)}
 if(q>0)q*=(1-smoothRange(r,plateau-7,plateau-3))*smoothRange(x,-30,-26)
 openMemo={x,z,v:q}
 return q
}
/**
 * Low knolls and dells over open country, and a few named rises: [x, z, height, radius]. Archipelago stage 9 raised them
 * (1.3/1.0/0.9 m → 1.8/1.4/1.25 m, a little wider) and the broad roll by about 40%; the fine ripple keeps its height, since it
 * sets the steepest grades on the trails that cross open country.
 */
const knolls=[[-21,4,1.8,6],[19,-7,1.4,5],[-3,19,1.25,5.5]] as const
export function inlandRelief(x:number,z:number){
 const roll=.62*Math.sin(x*.23+z*.11+1.3)*Math.cos(z*.19-x*.07+.4)+.25*Math.sin(x*.47-z*.37+2.1)
 return openGround(x,z)*(roll+knolls.reduce((s,[kx,kz,h,r])=>s+h*Math.exp(-((x-kx)**2+(z-kz)**2)/(r*r)),0))
}
/**
 * Low dunes over the upper beach (about 0.3 m), so the sand belt reads as drifted sand rather than a smooth ramp;
 * none on the play sand (game/sand sandRect, written out) or the dock approach, and they flatten toward the wet sand.
 */
function beachDunes(x:number,z:number,r:number,angle:number,coast:number){
 const plateau=plateauRadiusAt(angle),band=smoothRange(r,plateau+.4,plateau+2.2)*(1-smoothRange(r,coast-3,coast-1.2))
 if(band===0)return 0
 const play=smoothRange(Math.max(Math.abs(x)-14.1,23.4-z),0,2.5)
 return band*play*freeShore(angle)*.3*(.55+.45*Math.sin(angle*31+1.3))*(.6+.4*Math.sin(r*1.4+angle*9))
}
/** Paths wander with the land instead of running as rings and spokes; the bend fades out wherever a path must end. */
export function pathWarp(x:number,z:number):[number,number]{
 const w=openGround(x,z)*1.3
 return[x+w*(Math.sin(z*.17+.7)+.5*Math.sin(z*.41-x*.13)),z+w*(Math.sin(x*.15+2.2)+.5*Math.sin(x*.37+z*.11))]
}
/** Where an authored path point actually lies on the ground: the p whose warp lands on it (fixed-point iteration). */
export function unwarpPath(qx:number,qz:number):[number,number]{
 let x=qx,z=qz
 for(let i=0;i<24;i++){const [wx,wz]=pathWarp(x,z);x+=(qx-wx)*.8;z+=(qz-wz)*.8}
 return[x,z]
}
export const pathWarpGLSL=/* glsl */`
float openGround(vec2 p){float q=1.0;
${quietSites.map(([x,z,r])=>` q*=smoothstep(${r.toFixed(1)},${(r+4).toFixed(1)},length(p-vec2(${x.toFixed(1)},${z.toFixed(1)})));`).join('\n')}
 float pl=plateauAt(p);return q*(1.0-smoothstep(pl-7.0,pl-3.0,length(p)))*smoothstep(-30.0,-26.0,p.x);}
vec2 pathWarp(vec2 p){float w=openGround(p)*1.3;return p+w*vec2(sin(p.y*.17+.7)+.5*sin(p.y*.41-p.x*.13),sin(p.x*.15+2.2)+.5*sin(p.x*.37+p.y*.11));}
`
/** Authored broad landforms, shared by rendered terrain, water limits and foundations. */
export function originalLandformHeight(x:number,z:number){
 const r=Math.hypot(x,z),angle=Math.atan2(z,x),coast=originalCoastRadius(angle)
 const shore=-islandShape.shoreDepth*smoothRange(r,plateauRadiusAt(angle),coast+islandShape.shoreExtension)
 const dx=-12.3,dz=-1,t=Math.max(0,Math.min(1,((x+1.7)*dx+(z+14)*dz)/(dx*dx+dz*dz)))
 // The terrace road shifts the hillside to its own grade instead of flattening it: a flat shelf cut
 // into the slope left banks the crossing trails could not climb (above the 0.85 walking limit).
 const road=1-smoothRange(Math.hypot(x+1.7-dx*t,z+14-dz*t),1.25,4)
 let hill=hillside(x,z)+(2.4+3.5344*t-hillside(-1.7+dx*t,-14+dz*t))*road
 hill*=smoothRange(Math.hypot(x-pond.x,z-pond.z),5.3,9)
 hill+=inlandRelief(x,z)+beachDunes(x,z,r,angle,coast)
 return shore+hill*(1-smoothRange(r,coast-2.8,coast+.9))
}
export function landformHeight(x:number,z:number){return x>72?Math.max(mistHeight(x,z),autumnHeight(x,z),tideHeight(x,z)):Math.max(extendWestLand(x,z,originalLandformHeight(x,z)),westCoveHeight(x,z))}
export function originalShorelineRadius(angle:number){let lo=30,hi=originalCoastRadius(angle)+islandShape.shoreExtension;for(let i=0;i<28;i++){const r=(lo+hi)/2;if(originalLandformHeight(Math.cos(angle)*r,Math.sin(angle)*r)>seaLevel)lo=r;else hi=r}return(lo+hi)/2}
export function shorelineRadius(angle:number){let lo=30,hi=coastRadius(angle)+islandShape.shoreExtension;for(let i=0;i<32;i++){const r=(lo+hi)/2;if(landformHeight(Math.cos(angle)*r,Math.sin(angle)*r)>seaLevel)lo=r;else hi=r}return(lo+hi)/2}
// A single enclosing sea ellipse stays continuous through the channels between the islands.
// The hull still samples actual terrain depth, so the envelope never makes land navigable.
export function seaRangeRadius(angle:number){
 // Extend the old ellipse's north/south axis, preserving every old sea point and a smooth hull boundary.
 const rx=146,rz=140,c=Math.cos(angle),s=Math.sin(angle),a=(c/rx)**2+(s/rz)**2,b=-2*(24*c/(rx*rx)+16*s/(rz*rz)),d=(24/rx)**2+(16/rz)**2-1
 return(-b+Math.sqrt(b*b-4*a*d))/(2*a)
}
export function isDockSurface(x:number,z:number,inset=0){return !!dockAt(x,z,inset)}
export function isBeachApproach(x:number,z:number){return x>32&&x<48&&Math.abs(z)<9.5}
