import {BufferAttribute,Matrix4,SkinnedMesh,Vector3,type Object3D} from 'three'
import {seats,type SeatSession} from '../game/expansion'
import {terrainHeight} from './terrain'

/** Local soft contact for the low hip/coat outline, upper legs and tail tip. The source sitting clip was
 * authored for a different seat. Fold its hanging outline onto this seat instead
 * of lifting the whole body until the thighs float. Only cloned vertex data changes.
 */
export function createBenchSeatContact(model:Object3D){
  const parts:{mesh:SkinnedMesh;original:BufferAttribute;indices:number[];changed:number[]}[]=[]
  model.traverse(o=>{
    if(!(o instanceof SkinnedMesh))return
    const {skinIndex,skinWeight}=o.geometry.attributes,indices:number[]=[]
    for(let i=0;i<skinIndex.count;i++){
      let hips=0;for(let n=0;n<4;n++)if(/Hips|UpLeg|tail_05/.test(o.skeleton.bones[skinIndex.getComponent(i,n)].name))hips+=skinWeight.getComponent(i,n)
      if(hips>.25)indices.push(i)
    }
    if(!indices.length)return
    o.geometry=o.geometry.clone()
    parts.push({mesh:o,original:(o.geometry.attributes.position as BufferAttribute).clone(),indices,changed:[]})
  })
  const p=new Vector3(),boneMatrix=new Matrix4(),skin=new Matrix4(),transform=new Matrix4()
  return {
    restore(){for(const part of parts){const pos=part.mesh.geometry.attributes.position;for(const i of part.changed)pos.setXYZ(i,part.original.getX(i),part.original.getY(i),part.original.getZ(i));if(part.changed.length)pos.needsUpdate=true;part.changed.length=0}},
    update(session:SeatSession|null){
      const seat=seats.find(s=>s.id===session?.id);if(!seat)return
      model.updateWorldMatrix(true,false);model.updateMatrixWorld(true)
      const top=terrainHeight(seat.x,seat.z)+.358,ca=Math.cos(seat.yaw),sa=Math.sin(seat.yaw)
      for(const part of parts){
        const {mesh}=part,{skinIndex,skinWeight,position}=mesh.geometry.attributes
        for(const i of part.indices){
          mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld)
          const dx=p.x-seat.x,dz=p.z-seat.z,side=dx*ca-dz*sa,forward=-dx*sa-dz*ca
          if(Math.abs(side)>.74||forward<-.23||forward>.36||p.y>=top)continue
          skin.elements.fill(0)
          for(let n=0;n<4;n++){
            const weight=skinWeight.getComponent(i,n);if(!weight)continue
            const index=skinIndex.getComponent(i,n)
            boneMatrix.multiplyMatrices(mesh.skeleton.bones[index].matrixWorld,mesh.skeleton.boneInverses[index])
            for(let k=0;k<16;k++)skin.elements[k]+=boneMatrix.elements[k]*weight
          }
          transform.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(skin).multiply(mesh.bindMatrix).invert()
          p.y=top;p.applyMatrix4(transform);position.setXYZ(i,p.x,p.y,p.z);part.changed.push(i)
        }
        if(part.changed.length)position.needsUpdate=true
      }
    },
    dispose(){for(const part of parts)part.mesh.geometry.dispose()},
  }
}
