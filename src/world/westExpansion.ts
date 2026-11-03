import {MathUtils} from 'three'

/** Stage B greybox: local westward land, with the original play area kept intact. */
export const westLand={x:-46,z:13,rx:36,rz:28,minX:-86.4} as const
/** The marsh: shallow pockets strung along the boardwalk, joined at their edges, with reed hummocks between. */
export const westWetland={x:-59,z:-4,waterY:.45,bedY:.14,lobes:[[-55.2,-4.6,3.1,2.3,.4],[-59.4,-3.1,3.4,2.7,1.9],[-63.4,-4.8,2.9,2.2,3.1],[-60.2,-6.6,1.9,1.3,4.4]]} as const
/** A zigzag of short deck runs across the marsh rather than one long plank: [x,z] turning points, deck a hand above the water. */
export const westBoardwalk={points:[[-51.6,-3.2],[-54.9,-4.7],[-57.5,-4.0],[-60.4,-2.5],[-62.9,-4.7],[-65.6,-3.8]],halfWidth:.75,y:.78} as const
export const westTrailPoints=[[-27,-10.13],[-27,-7],[-33,-7],[-35,-3],[-44,-3],[-49,-3.2],...westBoardwalk.points,[-67.4,-3.4],[-68,7],[-62,23],[-45,28],[-43,15],[-33,14],[-30.5,14],[-29.5,13],[-28,13],[-27,14],[-22,14],[-21.5,14.5],[-16.5,14.5],[-16,14],[-14,14]] as const
export const westPaths=westTrailPoints.slice(1).map((p,i)=>[...westTrailPoints[i],...p] as const)

/** The west lobe's edge wanders in and out (small headlands and bights) instead of tracing a clean ellipse. */
export function westLandRadius(x:number,z:number){
 const dx=(x-westLand.x)/westLand.rx,dz=(z-westLand.z)/westLand.rz,a=Math.atan2(dz,dx)
 return Math.hypot(dx,dz)/(1+.05*Math.sin(a*3+.7)+.035*Math.sin(a*7-1.3)+.02*Math.sin(a*13+.2))
}
/**
 * Where the west lobe meets the old south shore the two coasts left a deep, narrow inlet. Low sand fills its inner
 * two-thirds (a capsule along the inlet's axis), leaving a broad crescent cove at its mouth.
 */
export const westBay={a:[-32.3,19],b:[-27.6,32.2],radius:6.8,top:.6} as const
export function westBayHeight(x:number,z:number){
 const [ax,az]=westBay.a,[bx,bz]=westBay.b,dx=bx-ax,dz=bz-az,t=MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1)
 const d=Math.hypot(x-ax-t*dx,z-az-t*dz)*(1+.08*Math.sin(Math.atan2(z-bz,x-bx)*3+.9))
 return westBay.top-(westBay.top+2.3)*MathUtils.smoothstep(d,westBay.radius*.45,westBay.radius)
}
/** Below 1 inside the marsh: the nearest pocket's wobbly ellipse radius, so every check shares one bank contour. */
export function westWetlandRadius(x:number,z:number){
 let r=Infinity
 for(const [cx,cz,rx,rz,phase] of westWetland.lobes){
  const dx=(x-cx)/rx,dz=(z-cz)/rz,a=Math.atan2(dz,dx)
  r=Math.min(r,Math.hypot(dx,dz)/(1+.09*Math.sin(a*3+phase)+.05*Math.cos(a*5-phase*1.7)))
 }
 return r
}
/** Same bank contour for the terrain colour, basin, water and walking checks. */
export const westWetlandGLSL=`float wetlandRadius(vec2 p){float r=1e4;vec2 q;float a;
${westWetland.lobes.map(([cx,cz,rx,rz,phase])=>`q=(p-vec2(${cx.toFixed(2)},${cz.toFixed(2)}))/vec2(${rx.toFixed(2)},${rz.toFixed(2)});a=atan(q.y,q.x);r=min(r,length(q)/(1.0+.09*sin(a*3.0+${phase.toFixed(2)})+.05*cos(a*5.0-${(phase*1.7).toFixed(3)})));`).join('\n')}
return r;}`
/** Distance to the boardwalk's centre line. */
export function westBoardwalkDistance(x:number,z:number){
 let d=Infinity;const p=westBoardwalk.points
 for(let i=0;i<p.length-1;i++){const [ax,az]=p[i],[bx,bz]=p[i+1],dx=bx-ax,dz=bz-az,t=MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);d=Math.min(d,Math.hypot(x-ax-t*dx,z-az-t*dz))}
 return d
}
export function onWestBoardwalk(x:number,z:number,inset=0){return westBoardwalkDistance(x,z)<=westBoardwalk.halfWidth-inset}
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
 // 1.11: the wandering edge reaches at most ~11% past the ellipse.
 const c=Math.cos(angle),s=Math.sin(angle),{x,z}=westLand,rx=(westLand.rx+padding)*1.11,rz=(westLand.rz+padding)*1.11
 const a=(c/rx)**2+(s/rz)**2,b=-2*(c*x/(rx*rx)+s*z/(rz*rz)),d=(x/rx)**2+(z/rz)**2-1,disc=b*b-4*a*d
 return disc>0?Math.max(0,(-b+Math.sqrt(disc))/(2*a)):0
}
