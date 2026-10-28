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
export const oceanNavigation={offshoreLimit:12,minDepth:.22} as const
export const dockPosts=[35.4,43.8].flatMap(x=>[-.86,.86].map(z=>({x,z,r:.2})))

export function coastRadius(angle:number){return islandShape.coastRadius+.85*Math.sin(angle*3+.4)+.55*Math.sin(angle*5-.8)+.25*Math.cos(angle*9)}
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
/** Authored broad landforms, shared by rendered terrain, water limits and foundations. */
export function landformHeight(x:number,z:number){
 const r=Math.hypot(x,z),coast=coastRadius(Math.atan2(z,x))
 const shore=-islandShape.shoreDepth*smoothRange(r,islandShape.plateauRadius,coast+islandShape.shoreExtension)
 const dx=-12.3,dz=-1,t=Math.max(0,Math.min(1,((x+1.7)*dx+(z+14)*dz)/(dx*dx+dz*dz)))
 // The terrace road shifts the hillside to its own grade instead of flattening it: a flat shelf cut
 // into the slope left banks the crossing trails could not climb (above the 0.85 walking limit).
 const road=1-smoothRange(Math.hypot(x+1.7-dx*t,z+14-dz*t),1.25,4)
 let hill=hillside(x,z)+(2.4+3.5344*t-hillside(-1.7+dx*t,-14+dz*t))*road
 hill*=smoothRange(Math.hypot(x-pond.x,z-pond.z),5.3,9)
 return shore+hill*(1-smoothRange(r,coast-2.8,coast+.9))
}
export function shorelineRadius(angle:number){let lo=30,hi=coastRadius(angle)+islandShape.shoreExtension;for(let i=0;i<28;i++){const r=(lo+hi)/2;if(landformHeight(Math.cos(angle)*r,Math.sin(angle)*r)>seaLevel)lo=r;else hi=r}return(lo+hi)/2}
export function seaRangeRadius(angle:number){return shorelineRadius(angle)+oceanNavigation.offshoreLimit}
export function isDockSurface(x:number,z:number,inset=0){return x>=coastalDock.minX+inset&&x<=coastalDock.maxX-inset&&z>=coastalDock.minZ+inset&&z<=coastalDock.maxZ-inset}
export function isBeachApproach(x:number,z:number){return x>32&&Math.abs(z)<9.5}
