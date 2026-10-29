import {MathUtils} from 'three'

/** Stage B greybox: local westward land, with the original play area kept intact. */
export const westLand={x:-46,z:13,rx:36,rz:28,minX:-86.4} as const
export const westWetland={x:-59,z:-4,rx:4.5,rz:3,waterY:.45,bedY:.14} as const
export const westBoardwalk={minX:-65,maxX:-53,z:-4,halfWidth:.95,y:.9} as const
export const westTrailPoints=[[-27,-10.13],[-27,-7],[-33,-7],[-35,-3],[-44,-3],[-59,-4],[-66,-4],[-68,7],[-62,23],[-45,28],[-43,15],[-33,14],[-30.5,14],[-29.5,13],[-28,13],[-27,14],[-22,14],[-21.5,14.5],[-16.5,14.5],[-16,14],[-14,14]] as const
export const westPaths=westTrailPoints.slice(1).map((p,i)=>[...westTrailPoints[i],...p] as const)

export function westLandRadius(x:number,z:number){return Math.hypot((x-westLand.x)/westLand.rx,(z-westLand.z)/westLand.rz)}
export function westWetlandRadius(x:number,z:number){
 const dx=(x-westWetland.x)/westWetland.rx,dz=(z-westWetland.z)/westWetland.rz,a=Math.atan2(dz,dx)
 return Math.hypot(dx,dz)/(1+.075*Math.sin(a*3+.4)+.045*Math.cos(a*5-.7))
}
/** Same bank contour for the terrain colour, basin, water and walking checks. */
export const westWetlandGLSL=`float wetlandRadius(vec2 p){vec2 q=(p-vec2(${westWetland.x.toFixed(1)},${westWetland.z.toFixed(1)}))/vec2(${westWetland.rx.toFixed(1)},${westWetland.rz.toFixed(1)});float a=atan(q.y,q.x);return length(q)/(1.0+.075*sin(a*3.0+.4)+.045*cos(a*5.0-.7));}`
export function onWestBoardwalk(x:number,z:number,inset=0){return x>=westBoardwalk.minX+inset&&x<=westBoardwalk.maxX-inset&&Math.abs(z-westBoardwalk.z)<=westBoardwalk.halfWidth-inset}
export function westTrailDistance(x:number,z:number){
 let d=Infinity
 for(const [ax,az,bx,bz] of westPaths){const dx=bx-ax,dz=bz-az,t=MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);d=Math.min(d,Math.hypot(x-ax-t*dx,z-az-t*dz))}
 return d
}
export function extendWestLand(x:number,z:number,original:number){
 const blend=MathUtils.smoothstep(-x,32,35.5)*MathUtils.smoothstep(Math.hypot(x,z),35,38)
 if(blend===0)return original
 const r=westLandRadius(x,z),plateau=.9
 const land=plateau-(plateau+2.3)*MathUtils.smoothstep(r,.78,1)
 const merged=Math.max(original,original+(land-original)*blend)
 const wetlandRadius=westWetlandRadius(x,z)
 // Keep the freshwater basin enclosed where its north bank approaches the lower coastal slope.
 const bank=merged+Math.max(0,plateau-merged)*(1-MathUtils.smoothstep(wetlandRadius,1.15,1.65))
 const basin=1-MathUtils.smoothstep(wetlandRadius,.7,1.35)
 return bank*(1-basin)+westWetland.bedY*basin
}
/** Outer ellipse intersection along a ray, used only to bound the actual shoreline search. */
export function westCoastRadius(angle:number,padding=0){
 const c=Math.cos(angle),s=Math.sin(angle),{x,z}=westLand,rx=westLand.rx+padding,rz=westLand.rz+padding
 const a=(c/rx)**2+(s/rz)**2,b=-2*(c*x/(rx*rx)+s*z/(rz*rz)),d=(x/rx)**2+(z/rz)**2-1,disc=b*b-4*a*d
 return disc>0?Math.max(0,(-b+Math.sqrt(disc))/(2*a)):0
}
