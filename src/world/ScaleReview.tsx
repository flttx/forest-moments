import {useFrame} from '@react-three/fiber'
import {useRef} from 'react'
import {Box3,Vector3,Mesh,SkinnedMesh,InstancedMesh,Matrix4} from 'three'
import type {Object3D} from 'three'
import {useForestStore} from '../game/store'

/** Development-only, one-shot world-space measurements, including evaluated skin poses. */
export function ScaleReview(){
 const elapsed=useRef(0),done=useRef(false)
 useFrame(({scene,gl},dt)=>{
  if(!import.meta.env.DEV||!new URLSearchParams(location.search).has('scaleqa')||done.current)return
  const s=useForestStore.getState();if(!s.workshopReady||!s.farmReady||!s.growthReady)return
  elapsed.current+=dt;if(elapsed.current<2)return
  scene.updateMatrixWorld(true);scene.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.update()})
  const records:object[]=[]
  const measure=(label:string,o:Object3D|undefined)=>{
   if(!o)return
   const b=new Box3().setFromObject(o,true);if(b.isEmpty())return
   records.push({label,min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new Vector3()).toArray()})
  }
  for(const n of ['raccoon','workshop','lookout','coastal-jetty'])measure(n,scene.getObjectByName('asset-'+n))
  const boat=scene.getObjectByName('asset-canoe');measure('canoe-hull',boat?.children[0]);measure('paddle-in-pose',boat?.children[2])
  const fishing=scene.getObjectByName('fishing-tools');measure('fish-in-pose',fishing?.children[1]);measure('rod-in-pose',fishing?.children[0])
  for(const [i,label] of ['rod','fish'].entries()){
   const o=fishing?.children[i];if(!o)continue
   const local=new Box3(),inverse=o.matrixWorld.clone().invert(),v=new Vector3()
   o.traverse(child=>{if(child instanceof Mesh)for(let n=0;n<child.geometry.attributes.position.count;n++){child.getVertexPosition(n,v).applyMatrix4(child.matrixWorld).applyMatrix4(inverse);local.expandByPoint(v)}})
   records.push({label:label+'-unscaled-posed-local',size:local.getSize(new Vector3()).toArray()})
  }
  const farm=scene.getObjectByName('forest-farm');measure('farm-facilities',farm?.children[0]);measure('hen-in-pose',farm?.children[1]);measure('sheep-in-pose',farm?.children[2])
  const room=scene.getObjectByName('workshop-interior');room?.traverse(o=>{if(o instanceof Mesh&&/^(Hero_|Prop_)/.test(o.name))measure(o.name,o)})
  const kit=scene.getObjectByName('forest-kit'),instances:Record<string,number[][]>={}
  kit?.traverse(o=>{
   if(!(o instanceof InstancedMesh)||o.name.startsWith('lod-'))return
   const name=o.name==='wooden-lanterns'?'lantern':o.name.split(/-\d|--/)[0]
   const values=instances[name]??=[];o.geometry.computeBoundingBox();const m=new Matrix4()
   for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);const b=o.geometry.boundingBox!.clone().applyMatrix4(m);values.push(b.getSize(new Vector3()).toArray())}
   instances[name]=values
  })
  gl.domElement.dataset.scaleQa=JSON.stringify({records,instances,method:'THREE precise world bounds with evaluated skeleton matrices; axis-aligned width/depth depend on pose and yaw'})
  done.current=true
 })
 return null
}
