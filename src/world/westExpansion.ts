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
 * Where the west lobe meets the old south shore the two coasts left a deep, narrow slot. It is opened into a small
 * shallow cove: dry sand at its head (a), the floor sliding gently under the sea level (-0.85) towards the mouth (b), and
 * sandy banks rising softly to meet each shore. The banks are capped lower towards the mouth, so the cove opens into the
 * sea instead of standing proud of it. Only ever raises the old slot floor (terrain takes the higher of the two).
 */
export const westCove={a:[-33.4,16.6],b:[-26.8,33.8],halfWidth:7.5,flat:2.5} as const
export function westCoveHeight(x:number,z:number){
 const [ax,az]=westCove.a,[bx,bz]=westCove.b,dx=bx-ax,dz=bz-az,t=MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1)
 // a wandering edge, so the banks are not a ruled trough
 // the west lobe's own shore stands further from the axis towards the mouth, so its ramp lengthens with it
 const ramp=4+3*t,west=(x-ax)*dz-(z-az)*dx<0,d=Math.hypot(x-ax-t*dx,z-az-t*dz)*(1+.1*Math.sin(t*9+(west?1.3:-1.3))),w=west?westCove.flat*MathUtils.smoothstep(t,.25,.55)+ramp+1.5:westCove.halfWidth
 const floor=MathUtils.lerp(-.35,-1.4,MathUtils.smoothstep(t,0,.8)),seaward=MathUtils.smoothstep(t,.1,.85)
 // The west lobe (0.9 m high) ended in a steep step along the slot, so the west bank climbs all the way up to it. At
 // the head (the west loop runs by) and at the mouth (open sea) both banks stay low, as the old south shore's does.
 const low=MathUtils.lerp(.05,-1.05,seaward),high=MathUtils.smoothstep(t,.03,.15)*(1-MathUtils.smoothstep(t,.7,.9))
 const top=west?MathUtils.lerp(low,.95,high):low
 // A flat shallow floor either side of the axis, then the banks: west an even ramp that stays above the old step
 // (1.4 m over 2 m) all the way up, east a soft dish.
 // the old step sits hard by the axis at the head, so the west floor only widens further out
 const f=west?westCove.flat*MathUtils.smoothstep(t,.25,.55):westCove.flat,bank=west?floor+(top-floor)*MathUtils.smoothstep(d,f-1,f+ramp):floor+(top-floor+.3)*(Math.max(0,d-f)/(w-f))**2
 return Math.min(bank,top)-4*MathUtils.smoothstep(d,w,w*1.45)
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
