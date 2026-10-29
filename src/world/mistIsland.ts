import {MathUtils} from 'three'

/** IT-01 first playable island: west landing, central clearing, north-east ridge. */
export const mistIsland={x:107,z:-10,rx:19.5,rz:17.5} as const
export const mistPine={x:106,z:-10} as const
export const mistLoop=[[88.2,-10],[95,-10],[99,-18],[110,-20],[118,-13],[116,-1],[106,4],[98,0],[95,-10]] as const
export const mistPaths=[...mistLoop.slice(1).map((p,i)=>[...mistLoop[i],...p] as const),[95,-10,102,-6],[102,-6,111,-5],[111,-5,116,-1]] as const
// Shared shoreline harmonics keep the terrain and ocean's shallows/foam on the same boundary.
const shoreLobes=[{amplitude:.045,frequency:7,phase:1},{amplitude:.025,frequency:11,phase:2.1}] as const
export function mistRadius(x:number,z:number){
 const dx=(x-mistIsland.x)/mistIsland.rx,dz=(z-mistIsland.z)/mistIsland.rz,a=Math.atan2(dz,dx)
 const base=Math.hypot(dx,dz)/(1+.045*Math.sin(a*3+.4)+.03*Math.cos(a*5))
 const bay=1-(1-MathUtils.smoothstep(x,91,97))*(1-MathUtils.smoothstep(Math.abs(z+10),2,6))
 const edge=MathUtils.smoothstep(base,.78,1.02)*bay
 return base-edge*shoreLobes.reduce((sum,l)=>sum+l.amplitude*Math.sin(a*l.frequency+l.phase),0)
}
export function mistPathDistance(x:number,z:number){
 let distance=Infinity
 for(const [ax,az,bx,bz] of mistPaths){const dx=bx-ax,dz=bz-az,t=MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);distance=Math.min(distance,Math.hypot(x-ax-dx*t,z-az-dz*t))}
 return distance
}
export function mistHeight(x:number,z:number){
 const r=mistRadius(x,z)
 if(r>=1.15)return -2.3
 const shore=1-MathUtils.smoothstep(r,.78,1.15)
 const ridge=3.8*Math.exp(-(((x-115)/7)**2)-((z+21)/6)**2)
 let h=-2.3+(3.5+ridge)*shore
 // The west bay's walkable grade meets the reused jetty with no step at its inland end.
 const approach=(1-MathUtils.smoothstep(Math.abs(z+10),1.2,3.8))*(1-MathUtils.smoothstep(x,91,96))*MathUtils.smoothstep(x,84,88.2)
 h=MathUtils.lerp(h,.12+Math.max(0,x-88.2)*.16,approach)
 return h
}
export const mistGLSL=`
float mistRadius(vec2 p){
 vec2 q=(p-vec2(${mistIsland.x.toFixed(1)},${mistIsland.z.toFixed(1)}))/vec2(${mistIsland.rx.toFixed(1)},${mistIsland.rz.toFixed(1)});float a=atan(q.y,q.x);
 float base=length(q)/(1.0+.045*sin(a*3.0+.4)+.03*cos(a*5.0));
 float bay=1.0-(1.0-smoothstep(91.0,97.0,p.x))*(1.0-smoothstep(2.0,6.0,abs(p.y+10.0)));
 return base-smoothstep(.78,1.02,base)*bay*(${shoreLobes.map(l=>`${l.amplitude.toFixed(3)}*sin(a*${l.frequency.toFixed(1)}+${l.phase.toFixed(1)})`).join('+')});
}
float mistSegment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
float mistPath(vec2 p){float d=1000.0;${mistPaths.map(([ax,az,bx,bz])=>`d=min(d,mistSegment(p,vec2(${ax.toFixed(2)},${az.toFixed(2)}),vec2(${bx.toFixed(2)},${bz.toFixed(2)})));`).join('')}return d;}
`
