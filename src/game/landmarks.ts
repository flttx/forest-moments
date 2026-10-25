import {cabin,camp} from './expansion'
import {workshopPosition,lookoutPosition,landing} from '../world/worldConfig'
import {woodSpot,workshopDoor} from './workshop'
export const landmarks = [
  {id:'bedroom',name:'林缘卧室',x:cabin.x,z:cabin.doorZ,hint:'越过北边的小溪，回家休息或看看鱼缸。'},
  {id:'campfire',name:'海风营地',x:camp.x,z:camp.z,hint:'靠近石圈点燃篝火，或在低座椅上坐下。'},
  { id: 'workshop', name: '木作工坊', x: workshopPosition[0], z: workshopPosition[2], hint: '找回东侧路边旧木墩，进入工坊在室内修整成木墩凳。' },
  { id: 'farm', name: '森林牧场', x: 8, z: 6, hint: '从北侧围栏开口进入，走到食槽左边，按 F 添料。' },
  { id: 'pond', name: '静水池塘', x: 1.5, z: -5, hint: '西岸抛竿，浮漂下沉时提竿，再交替收线与放松鱼线。' },
  { id: 'lookout', name: '林间瞭望塔', x: lookoutPosition[0], z: lookoutPosition[2], hint: '从东侧楼梯脚进入观景视角，方向键环顾，F 或 Esc 返回。' },
  { id: 'grove', name: '树苗种植角', x: 0, z: 8, hint: '种下第一棵树，森林将记得它。' },
  { id: 'dock', name: '海边码头', x: landing.x, z: landing.z, hint: '沿东岸沙滩走到木码头，在海上沿岛划行，回到泊位停稳后下船。' },
] as const

export type LandmarkId = (typeof landmarks)[number]['id']

export function findNearestLandmark(x: number, z: number, radius = 3.1): LandmarkId | null {
  if(Math.hypot(x-woodSpot.x,z-woodSpot.z)<1.6||Math.hypot(x-workshopDoor.x,z-workshopDoor.z)<2.1)return'workshop'
  let nearest: LandmarkId | null = null
  let best = radius
  for (const point of landmarks) {
    const distance = Math.hypot(point.x - x, point.z - z)
    if (distance < best) {
      best = distance
      nearest = point.id
    }
  }
  return nearest
}
