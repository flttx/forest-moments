/** Shared world-space contracts: rendering, navigation, interaction and QA use these coordinates. */
export const seaLevel=-.85
export const islandShape={coastRadius:29,walkRadius:23,plateauRadius:23.5,meshSize:72,shoreDepth:2.3,shoreExtension:1.8,loopRadius:19.5} as const
export const workshopPosition=[-12,0,8] as const
export const lookoutPosition=[13,0,-8] as const
export const pond={x:6,z:-5,radius:4.05,waterY:-.08} as const
export const coastalDock={minX:23,maxX:32.2,minZ:-1.1,maxZ:1.1,deckY:.12} as const
export const landing={x:30.6,z:.8} as const
export const mooring={x:30.6,z:2.15,heading:0} as const
export const oceanNavigation={offshoreLimit:12,minDepth:.22} as const
export const dockPosts=[23.4,31.8].flatMap(x=>[-.86,.86].map(z=>({x,z,r:.2})))

export function coastRadius(angle:number){return islandShape.coastRadius+.85*Math.sin(angle*3+.4)+.55*Math.sin(angle*5-.8)+.25*Math.cos(angle*9)}
let low=0,high=1
for(let i=0;i<30;i++){const t=(low+high)/2;if(t*t*(3-2*t)<-seaLevel/islandShape.shoreDepth)low=t;else high=t}
export const shoreWaterFraction=(low+high)/2
export function shorelineRadius(angle:number){return islandShape.plateauRadius+(coastRadius(angle)+islandShape.shoreExtension-islandShape.plateauRadius)*shoreWaterFraction}
export function seaRangeRadius(angle:number){return shorelineRadius(angle)+oceanNavigation.offshoreLimit}
export function isDockSurface(x:number,z:number,inset=0){return x>=coastalDock.minX+inset&&x<=coastalDock.maxX-inset&&z>=coastalDock.minZ+inset&&z<=coastalDock.maxZ-inset}
export function isBeachApproach(x:number,z:number){return x>20&&Math.abs(z)<6.5}
