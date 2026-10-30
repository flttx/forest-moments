import {MathUtils} from 'three'

/** IT-03 first pass: low rock shelf, three enclosed pools, a permanently dry loop. */
export const tideIsland={x:100,z:101,rx:17,rz:13} as const
export const tideBerth={id:'tide',landing:{x:79.6,z:100.3},mooring:{x:79.6,z:98.95,heading:Math.PI},dock:{minX:78,maxX:87.2,minZ:100,maxZ:102.2,deckY:.12}} as const
export const tideObservation={x:101,z:100} as const
export const tideLoop=[[87.2,101.1],[91,96],[96,92],[105,93],[110,99],[108,108],[101,110],[91,108],[89,103],[87.2,101.1]] as const
export const tidePaths=[...tideLoop.slice(1).map((p,i)=>[...tideLoop[i],...p] as const),[110,99,101,100] as const]
export const tidePools=[{x:99,z:97,rx:2.8,rz:2,phase:.3},{x:105,z:104,rx:2,rz:1.6,phase:1.7},{x:95,z:105,rx:1.7,rz:1.35,phase:3}] as const
export const tidePoolWaterY=.18
export function tideRadius(x:number,z:number){
 const dx=(x-tideIsland.x)/tideIsland.rx,dz=(z-tideIsland.z)/tideIsland.rz,a=Math.atan2(dz,dx)
 return Math.hypot(dx,dz)/(1+.055*Math.sin(a*3+.7)+.035*Math.cos(a*5-.2))
}
export function poolRadius(x:number,z:number,p:typeof tidePools[number]){
 const dx=(x-p.x)/p.rx,dz=(z-p.z)/p.rz,a=Math.atan2(dz,dx)
 return Math.hypot(dx,dz)/(1+.08*Math.sin(a*3+p.phase)+.045*Math.cos(a*5-p.phase))
}
export function tidePathDistance(x:number,z:number){
 let distance=Infinity
 for(const [ax,az,bx,bz] of tidePaths){const dx=bx-ax,dz=bz-az,t=MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);distance=Math.min(distance,Math.hypot(x-ax-dx*t,z-az-dz*t))}
 return distance
}
export function tideHeight(x:number,z:number){
 const r=tideRadius(x,z)
 if(r>=1.16)return -2.3
 const shelf=.62+.27*Math.sin(x*.24+z*.12)*Math.sin(z*.27)+.48*Math.exp(-(((x-108)/5)**2)-((z-95)/4)**2)
 let h=-2.3+(2.3+shelf)*(1-MathUtils.smoothstep(r,.78,1.16))
 const approach=(1-MathUtils.smoothstep(Math.abs(z-101.1),1.2,3.6))*(1-MathUtils.smoothstep(x,89,94))*MathUtils.smoothstep(x,82,87.2)
 h=MathUtils.lerp(h,.12+Math.max(0,x-87.2)*.12,approach)
 for(const p of tidePools)h=MathUtils.lerp(-.18,h,MathUtils.smoothstep(poolRadius(x,z,p),.68,1.3))
 return h
}
export function inTidePool(x:number,z:number,margin=.28){return tidePools.some(p=>poolRadius(x,z,p)<1+margin/Math.min(p.rx,p.rz))}
export const tideGLSL=`
float tideRadius(vec2 p){vec2 q=(p-vec2(100.0,101.0))/vec2(17.0,13.0);float a=atan(q.y,q.x);return length(q)/(1.0+.055*sin(a*3.0+.7)+.035*cos(a*5.0-.2));}
float tidePool(vec2 p,vec4 pool,float phase){vec2 q=(p-pool.xy)/pool.zw;float a=atan(q.y,q.x);return length(q)/(1.0+.08*sin(a*3.0+phase)+.045*cos(a*5.0-phase));}
float tidePoolDistance(vec2 p){float d=1000.0;${tidePools.map(p=>`d=min(d,tidePool(p,vec4(${p.x.toFixed(1)},${p.z.toFixed(1)},${p.rx.toFixed(2)},${p.rz.toFixed(2)}),${p.phase.toFixed(2)}));`).join('')}return d;}
float tidePath(vec2 p){float d=1000.0;${tidePaths.map(([ax,az,bx,bz])=>`{vec2 a=vec2(${ax.toFixed(2)},${az.toFixed(2)}),v=vec2(${(bx-ax).toFixed(2)},${(bz-az).toFixed(2)});d=min(d,length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.0,1.0)));}`).join('')}return d;}
`
