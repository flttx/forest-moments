/** IE-02 logs sit beside the clearing paths. The hollow is visual, not a crawl-through route. */
export const mistLogs=[
 {x:101,z:-9.5,yaw:-.3,scale:1},
 {x:110.5,z:-8,yaw:.3,scale:.78},
] as const
// Physical envelope includes the chipped ends and bark, measured against the authored GLB.
export const mistLogHalf={x:1.65,z:.55} as const
export function mistLogDistance(x:number,z:number){
 return Math.min(...mistLogs.map(p=>{
  const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw)
  return Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-mistLogHalf.x*p.scale),Math.max(0,Math.abs(s*dx+c*dz)-mistLogHalf.z*p.scale))
 }))
}
