import {Object3D,Quaternion,Vector3} from 'three'
import {woodworkPose} from '../game/woodworkPose'
function aim(joint:Object3D,child:Object3D,target:Vector3){
 const origin=joint.getWorldPosition(new Vector3()),from=child.getWorldPosition(new Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize()
 const parent=joint.parent!.getWorldQuaternion(new Quaternion()),turn=new Quaternion().setFromUnitVectors(from,to)
 joint.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));joint.updateWorldMatrix(false,true)
}
/** Two-bone arm IK with outward elbow poles; keeps the elbow bending direction stable. */
export function solveWoodwork(model:Object3D,stroke:number){
 const pose=woodworkPose(stroke),positions:number[][]=[]
 for(const [side,offset] of [['Left',-.02],['Right',.10]] as const){
  const arm=model.getObjectByName(`mixamorig${side}Arm`),fore=model.getObjectByName(`mixamorig${side}ForeArm`),hand=model.getObjectByName(`mixamorig${side}Hand`),end=model.getObjectByName(`mixamorig${side}HandIndex1`)
  if(!arm||!fore||!hand||!end)continue
  model.updateWorldMatrix(true,true)
  const target=new Vector3(pose.x+(side==='Left'?-.035:.035),pose.y+.12,pose.z+offset)
  const shoulder=arm.getWorldPosition(new Vector3()),elbow=fore.getWorldPosition(new Vector3()),wrist=hand.getWorldPosition(new Vector3()),tip=end.getWorldPosition(new Vector3())
  const upper=shoulder.distanceTo(elbow),lower=elbow.distanceTo(wrist),palm=wrist.distanceTo(tip)
  const desiredWrist=target.clone().add(new Vector3(0,0,palm))
  const axis=desiredWrist.clone().sub(shoulder),distance=Math.max(.0001,Math.min(axis.length(),upper+lower-.0001));axis.normalize()
  const pole=new Vector3(side==='Left'?-.9:.9,.2,.25);pole.addScaledVector(axis,-pole.dot(axis)).normalize()
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along))
  const desiredElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,height)
  aim(arm,fore,desiredElbow);aim(fore,hand,desiredWrist);aim(hand,end,target)
  end.getWorldPosition(tip);positions.push([tip.x,tip.y,tip.z,tip.distanceTo(target)])
 }
 return{pose,hands:positions}
}
