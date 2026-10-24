import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const canvas = document.querySelector('canvas')
const slider = document.querySelector('#time')
const button = document.querySelector('#play')
const status = document.querySelector('#status')
const reviewVersion='center-final-11'
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(1)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
const scene = new THREE.Scene()
scene.background = new THREE.Color('#eee9dd')
scene.add(new THREE.HemisphereLight(0xfff8e8, 0x777769, 2))
for (const [x,y,z,power] of [[3,5,4,3],[-4,3,-4,2]]) {
  const light = new THREE.DirectionalLight(0xfff8ed, power)
  light.position.set(x,y,z); scene.add(light)
}
const camera = new THREE.PerspectiveCamera(38,1,.01,100)
const controls = new OrbitControls(camera,canvas)
function view() {
  const name = document.querySelector('#view').value
  const positions = { right:[2.5,2.4,4], left:[2.5,2.4,-4], front:[5,1.4,0], close:[1.4,1.2,1.6], stern:[-2.2,1.6,2] }
  camera.position.fromArray(positions[name])
  controls.target.set(name==='stern'?-.6:0,name==='close'?.45:.2,0); controls.update()
}
document.querySelector('#view').addEventListener('change',view); view()
const water = new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshStandardMaterial({color:0x83b7ad,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}))
water.rotation.x=-Math.PI/2; water.position.y=-.355; water.visible=false;scene.add(water)
document.querySelector('#water').addEventListener('change',(e)=>{water.visible=e.target.checked})
let playing=false, time=0, previous, mixer, model, clips=[], paddle, propTrack, character, vessel, layoutCandidate, compactCandidate, seat, sternCandidate, sternModel, centerCandidate, centerModel, centerTrack
const layoutShift=new THREE.Vector3()
function applyLayout() {
  const center=document.querySelector('#layout').value==='center'
  const candidate=document.querySelector('#layout').value==='candidate'
  const compact=document.querySelector('#layout').value==='compact'
  const stern=document.querySelector('#layout').value==='stern'
  const layout=center?centerCandidate:stern?sternCandidate:candidate?layoutCandidate:compact?compactCandidate:null
  const shift=layout?layout.characterShift:[0,0,0]
  layoutShift.set(shift[0],shift[2],-shift[1])
  character.position.set(-.012988392263650894,.36983680725097656,-.013671868480741978).add(layoutShift)
  const scale=layout?layout.boatScale:.5
  vessel.scale.setScalar(scale);water.position.y=stern?sternCandidate.waterZ:candidate?layoutCandidate.waterZ:-.355
  seat.visible=candidate
  vessel.visible=!stern&&!center;sternModel.visible=stern;centerModel.visible=center
  scene.updateMatrixWorld(true)
  status.textContent=center?'浣熊坐在中间木座上，保留原动作、衣服和尾巴；原桨按实际握持随动。':stern?'未采用：人物后移 0.6 米，偏离原中间椅子；v3 仅导出，尚未完成几何与视觉复核。':candidate?'未采用：高座台改变船内造型，桨仍有 1 帧碰座台；217 帧桨/船壳相交为 0，不能视为整体通过。':compact?'已否决：缩船虽能避开桨，但靴子和尾巴穿出船体。':'恢复原中间椅子基准：原动作与原桨不变，臀部落座高度及船体相交仍待修正。'
}
document.querySelector('#layout').addEventListener('change',()=>{if(!mixer)return;applyLayout();show(time)})
document.querySelector('#actor').addEventListener('change',(e)=>{if(character){character.visible=e.target.checked;paddle.visible=e.target.checked}})
function show(t) {
  time=t; mixer.setTime(t); model.updateMatrixWorld(true)
  slider.value=String(t); document.querySelector('#time-value').textContent=`${t.toFixed(2)} s`
  const hands={}
  for (const side of ['Left','Right']) {
    const hand=model.getObjectByName(`mixamorig${side}Hand`)
    const knuckle=model.getObjectByName(`mixamorig${side}HandIndex1`)
    hands[side]=hand.getWorldPosition(new THREE.Vector3()).lerp(knuckle.getWorldPosition(new THREE.Vector3()),.5).toArray()
  }
  const activeTrack=document.querySelector('#layout').value==='center'?centerTrack:propTrack
  const lastFrame=activeTrack.frames.length-1
  const rawFrame=Math.min(t*(activeTrack.sampleFPS??30),lastFrame)
  const frame=Math.abs(rawFrame-Math.round(rawFrame))<.0001?Math.round(rawFrame):rawFrame
  const index=Math.floor(frame), u=frame-index
  const a=activeTrack.frames[index],b=activeTrack.frames[Math.min(index+1,lastFrame)]
  paddle.scale.setScalar(activeTrack.scale)
  paddle.position.fromArray(a.position).lerp(new THREE.Vector3().fromArray(b.position),u)
  paddle.position.add(layoutShift)
  paddle.quaternion.fromArray(a.quaternion).slerp(new THREE.Quaternion().fromArray(b.quaternion),u)
  paddle.updateMatrixWorld(true)
  // At the hand-off both hands are on the shaft. Do not interpolate metadata
  // from one hand's grip point to the other while still testing the first hand.
  const pivot=new THREE.Vector3().fromArray(a.pivot).lerp(new THREE.Vector3().fromArray(a.held===b.held?b.pivot:a.pivot),u)
  paddle.localToWorld(pivot)
  const grips=a.gripTargets?Object.fromEntries(['Left','Right'].map(side=>{
    const pa=a.gripTargets[side],pb=b.gripTargets[side]
    return [side,new THREE.Vector3(pa[0],pa[2],-pa[1]).lerp(new THREE.Vector3(pb[0],pb[2],-pb[1]),u).add(layoutShift).toArray()]
  })):hands
  const heldError=pivot.distanceTo(new THREE.Vector3().fromArray(grips[a.held]))
  const shaft=new THREE.Vector3(2.05,0,-1.95).normalize().applyQuaternion(paddle.quaternion)
  const gripErrors=Object.fromEntries(Object.entries(grips).map(([s,p])=>[s,new THREE.Vector3().fromArray(p).sub(pivot).cross(shaft).length()]))
  canvas.dataset.paddleQa=JSON.stringify({ready:true,reviewVersion,time,playing,clips,hands,grips,layout:{name:document.querySelector('#layout').value,shift:layoutShift.toArray(),boatScale:vessel.scale.x,sternVisible:sternModel.visible,sternAsset:sternCandidate.asset,centerVisible:centerModel.visible,centerAsset:centerCandidate.asset},source:'original rig-mixamo-v6 paddle; no arm overrides',paddle:{visible:paddle.visible,parts:paddle.children.map(o=>o.name),held:a.held,regrip:a.regrip||(u>0&&b.regrip),heldError,gripErrors},triangles:renderer.info.render.triangles})
}
slider.addEventListener('input',()=>{playing=false;button.textContent='播放';show(Number(slider.value))})
button.addEventListener('click',()=>{playing=!playing;button.textContent=playing?'暂停':'播放'})
try {
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [gltf,boat,trackResponse,layoutResponse,compactResponse,sternResponse]=await Promise.all([
    loader.loadAsync('/assets/models/raccoon.glb'),loader.loadAsync('/assets/runtime-encoding/before/canoe.glb'),
    fetch('/docs/evidence/assets/2026-10-23-paddle-prop/prop-track.json'),
    fetch('/docs/evidence/assets/2026-10-23-paddle-layout/layout-config.json'),
    fetch('/docs/evidence/assets/2026-10-23-paddle-layout/compact-rejected/layout-search.json'),
    fetch('/docs/evidence/assets/2026-10-23-canoe-stern/candidate.json'),
  ])
  if(!trackResponse.ok)throw Error('桨随动数据读取失败')
  propTrack=await trackResponse.json()
  if(!layoutResponse.ok)throw Error('布局数据读取失败')
  layoutCandidate=await layoutResponse.json()
  if(!compactResponse.ok)throw Error('对照布局数据读取失败')
  compactCandidate=(await compactResponse.json()).finalists[0]
  if(!sternResponse.ok)throw Error('后舱候选数据读取失败')
  sternCandidate=await sternResponse.json()
  sternModel=(await loader.loadAsync(sternCandidate.asset)).scene;scene.add(sternModel)
  const centerResponse=await fetch('/docs/evidence/assets/2026-10-23-paddle-final/candidate.json')
  if(!centerResponse.ok)throw Error('中央座板数据读取失败')
  centerCandidate=await centerResponse.json();centerTrack=await(await fetch('/'+centerCandidate.propTrack)).json();centerModel=(await loader.loadAsync(centerCandidate.asset)).scene;scene.add(centerModel)
  seat=(await loader.loadAsync(layoutCandidate.seatAsset)).scene;scene.add(seat)
  // Direct source playback: no IK, rebaking, track editing or arm overrides.
  character=new THREE.Group()
  character.scale.setScalar(1.4/.6);character.rotation.y=Math.PI/2
  character.position.set(-.012988392263650894,.36983680725097656,-.013671868480741978)
  model=gltf.scene;character.add(model);scene.add(character)
  // Reuse both delivered paddle meshes with their native transforms/materials.
  // Only this independent object's transform follows the prop track.
  paddle=new THREE.Group();paddle.name='Original_paddle_prop';paddle.scale.setScalar(propTrack.scale)
  boat.scene.updateMatrixWorld(true)
  const parts=[];boat.scene.traverse(o=>{if(o.name.startsWith('Paddle_'))parts.push(o)})
  if(parts.length!==2)throw Error('船模型中的桨杆/桨叶不完整')
  for(const part of parts){const native=part.matrixWorld.clone();paddle.add(part);native.decompose(part.position,part.quaternion,part.scale)}
  scene.add(paddle)
  vessel=new THREE.Group();vessel.scale.setScalar(.5);vessel.rotation.y=-Math.PI/4
  vessel.add(boat.scene);scene.add(vessel)
  const clip=gltf.animations.find(c=>c.name==='paddle')
  if (!clip) throw Error('源模型缺少 paddle 动作')
  mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play()
  clips=[{name:clip.name,duration:clip.duration,tracks:clip.tracks.length}]
  scene.updateMatrixWorld(true)
  button.disabled=false;slider.disabled=false;applyLayout();show(0)
} catch(error) {status.textContent=`加载失败：${error.message}`;console.error(error)}
function draw(now) {
  const rect=canvas.getBoundingClientRect()
  if(canvas.width!==Math.round(rect.width)||canvas.height!==Math.round(rect.height)) {
    renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix()
  }
  if(mixer) show(playing?(time+Math.min((now-(previous??now))/1000,.05))%7.2:time)
  previous=now;renderer.render(scene,camera);requestAnimationFrame(draw)
}
requestAnimationFrame(draw)
