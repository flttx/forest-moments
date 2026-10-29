import {MathUtils} from 'three'

/** IT-02: southwest landing, open woodland, a gentle northeast lookout hill. */
// Move the whole local layout together: preserve paths, hull clearance and save berth IDs.
export const autumnOffset={x:4,z:18} as const
const point=(x:number,z:number)=>({x:x+autumnOffset.x,z:z+autumnOffset.z})
export const autumnIsland={...point(108,29),rx:20.5,rz:16.5} as const
export const autumnBerth={id:'autumn',landing:point(83.6,32.3),mooring:{...point(83.6,30.95),heading:Math.PI},dock:{minX:82+autumnOffset.x,maxX:91.2+autumnOffset.x,minZ:32+autumnOffset.z,maxZ:34.2+autumnOffset.z,deckY:.12}} as const
export const autumnVista=point(117,24)
export const autumnLoop=[[91.2,33.1],[97,33],[101,24],[110,20],[117,24],[119,31],[113,38],[104,39],[97,33]].map(([x,z])=>[x+autumnOffset.x,z+autumnOffset.z] as const)
export const autumnPaths=[...autumnLoop.slice(1).map((p,i)=>[...autumnLoop[i],...p] as const),...[[101,24,106,29],[106,29,113,38]].map(([ax,az,bx,bz])=>[ax+autumnOffset.x,az+autumnOffset.z,bx+autumnOffset.x,bz+autumnOffset.z] as const)] as const
export function autumnRadius(x:number,z:number){
 const dx=(x-autumnIsland.x)/autumnIsland.rx,dz=(z-autumnIsland.z)/autumnIsland.rz,a=Math.atan2(dz,dx)
 return Math.hypot(dx,dz)/(1+.035*Math.sin(a*3+.7)+.025*Math.cos(a*5-.2))
}
export function autumnPathDistance(x:number,z:number){
 let distance=Infinity
 for(const [ax,az,bx,bz] of autumnPaths){const dx=bx-ax,dz=bz-az,t=MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);distance=Math.min(distance,Math.hypot(x-ax-dx*t,z-az-dz*t))}
 return distance
}
export function autumnHeight(x:number,z:number){
 const r=autumnRadius(x,z)
 if(r>=1.14)return -2.3
 x-=autumnOffset.x;z-=autumnOffset.z
 const hill=2.7*Math.exp(-(((x-115)/7.5)**2)-((z-23)/6.5)**2)
 let h=-2.3+(3.2+hill)*(1-MathUtils.smoothstep(r,.77,1.14))
 const approach=(1-MathUtils.smoothstep(Math.abs(z-33.1),1.2,3.8))*(1-MathUtils.smoothstep(x,94,99))*MathUtils.smoothstep(x,86,91.2)
 h=MathUtils.lerp(h,.12+Math.max(0,x-91.2)*.14,approach)
 return h
}
export const autumnGLSL=`
float autumnRadius(vec2 p){vec2 q=(p-vec2(${autumnIsland.x.toFixed(1)},${autumnIsland.z.toFixed(1)}))/vec2(20.5,16.5);float a=atan(q.y,q.x);return length(q)/(1.0+.035*sin(a*3.0+.7)+.025*cos(a*5.0-.2));}
float autumnSegment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
float autumnPath(vec2 p){float d=1000.0;${autumnPaths.map(([ax,az,bx,bz])=>`d=min(d,autumnSegment(p,vec2(${ax.toFixed(2)},${az.toFixed(2)}),vec2(${bx.toFixed(2)},${bz.toFixed(2)})));`).join('')}return d;}
`
