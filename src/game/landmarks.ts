export const landmarks = [
  { id: 'workshop', name: '木作工坊', x: -8, z: 3, hint: '工坊与材料制作将在后续开发。' },
  { id: 'farm', name: '森林牧场', x: 8, z: 6, hint: '动物养殖将在后续开发。' },
  { id: 'pond', name: '静水池塘', x: 1.5, z: -5, hint: '钓鱼系统将在后续开发。' },
  { id: 'lookout', name: '林间瞭望塔', x: -8, z: -8, hint: '登塔观景将在后续开发。' },
  { id: 'grove', name: '树苗种植角', x: 0, z: 8, hint: '种下第一棵树，森林将记得它。' },
  { id: 'dock', name: '木船码头', x: 11, z: -8, hint: '划船将在后续开发。' },
] as const

export type LandmarkId = (typeof landmarks)[number]['id']

export function findNearestLandmark(x: number, z: number, radius = 3.1): LandmarkId | null {
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
