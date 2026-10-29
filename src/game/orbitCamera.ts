// Interaction constants follow my-blog's CameraHeading / FollowCamera.
// Our yaw uses the actor convention: forward = (-sin yaw, -cos yaw).
export const orbitConfig={yawPerPixel:.004,pitchPerPixel:.003,minPitch:Math.PI/18,maxPitch:Math.PI*.36,minZoom:.55,maxZoom:18,indoorMaxZoom:1.6,keySpeed:1.8,defaultPitch:.31} as const
export const wrapAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a))
// Opening view looks south-west past the pond to the workshop, with open sea and sky behind it.
export const spawnYaw=Math.PI*3/4
// About 18 degrees down: the upper frame keeps a band of sky and sea behind the raccoon.
export function createOrbit(yaw=Math.PI/4){const pitch:number=orbitConfig.defaultPitch;return{yaw,targetYaw:yaw,pitch,targetPitch:pitch,zoom:1,targetZoom:1,idle:Infinity}}
export type Orbit=ReturnType<typeof createOrbit>
export function rotateOrbit(s:Orbit,dx:number,dy:number,minPitch:number=orbitConfig.minPitch,maxPitch:number=orbitConfig.maxPitch){
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return
 s.targetYaw=wrapAngle(s.targetYaw+dx*orbitConfig.yawPerPixel)
 s.targetPitch=Math.max(minPitch,Math.min(maxPitch,s.targetPitch-dy*orbitConfig.pitchPerPixel))
 if(dx||dy)s.idle=0
}
export function zoomOrbit(s:Orbit,pixels:number,maxZoom:number=orbitConfig.maxZoom,minZoom:number=orbitConfig.minZoom){
 if(Number.isFinite(pixels))s.targetZoom=Math.max(minZoom,Math.min(maxZoom,s.targetZoom*Math.exp(Math.max(-300,Math.min(300,pixels))*.0015)))
}
export function cancelOrbit(s:Orbit){s.targetYaw=s.yaw;s.targetPitch=s.pitch;s.targetZoom=s.zoom}
export function stepOrbit(s:Orbit,dt:number,reduced=false,boatHeading?:number){
 if(!Number.isFinite(dt)||dt<=0)return
 const h=Math.min(dt,.05),a=reduced?1:1-Math.exp(-10*h)
 if(boatHeading!==undefined&&s.idle>=1.5)s.targetYaw=wrapAngle(s.targetYaw+wrapAngle(boatHeading-s.targetYaw)*(1-Math.exp(-1.2*h)))
 s.yaw=wrapAngle(s.yaw+wrapAngle(s.targetYaw-s.yaw)*a)
 s.pitch+=(s.targetPitch-s.pitch)*a;s.zoom+=(s.targetZoom-s.zoom)*a;s.idle+=h
}
