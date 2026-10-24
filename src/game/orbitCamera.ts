// Interaction constants follow my-blog's CameraHeading / FollowCamera.
// Our yaw uses the actor convention: forward = (-sin yaw, -cos yaw).
export const orbitConfig={yawPerPixel:.004,pitchPerPixel:.003,minPitch:Math.PI/18,maxPitch:Math.PI*.36,minZoom:.55,maxZoom:1.6,keySpeed:1.8} as const
export const wrapAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a))
export function createOrbit(yaw=Math.PI/4){return{yaw,targetYaw:yaw,pitch:Math.atan2(5,9),targetPitch:Math.atan2(5,9),zoom:1,targetZoom:1,idle:Infinity}}
export type Orbit=ReturnType<typeof createOrbit>
export function rotateOrbit(s:Orbit,dx:number,dy:number){
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return
 s.targetYaw=wrapAngle(s.targetYaw+dx*orbitConfig.yawPerPixel)
 s.targetPitch=Math.max(orbitConfig.minPitch,Math.min(orbitConfig.maxPitch,s.targetPitch-dy*orbitConfig.pitchPerPixel))
 if(dx||dy)s.idle=0
}
export function zoomOrbit(s:Orbit,pixels:number){
 if(Number.isFinite(pixels))s.targetZoom=Math.max(orbitConfig.minZoom,Math.min(orbitConfig.maxZoom,s.targetZoom*Math.exp(Math.max(-300,Math.min(300,pixels))*.0015)))
}
export function cancelOrbit(s:Orbit){s.targetYaw=s.yaw;s.targetPitch=s.pitch;s.targetZoom=s.zoom}
export function stepOrbit(s:Orbit,dt:number,reduced=false,boatHeading?:number){
 if(!Number.isFinite(dt)||dt<=0)return
 const h=Math.min(dt,.05),a=reduced?1:1-Math.exp(-10*h)
 if(boatHeading!==undefined&&s.idle>=1.5)s.targetYaw=wrapAngle(s.targetYaw+wrapAngle(boatHeading-s.targetYaw)*(1-Math.exp(-1.2*h)))
 s.yaw=wrapAngle(s.yaw+wrapAngle(s.targetYaw-s.yaw)*a)
 s.pitch+=(s.targetPitch-s.pitch)*a;s.zoom+=(s.targetZoom-s.zoom)*a;s.idle+=h
}
