import data from './pine-extents.json'

const {sectors,binHeight,extents}=data as {sectors:number;binHeight:number;extents:number[][]}

/**
 * How far a pine's foliage reaches from its trunk in the world direction `angle` (radians, x toward z), within the
 * height window [low, high] metres above the trunk foot. The lowest whorl of branches only covers some directions;
 * elsewhere only the trunk (its own circle) is in the way. Measured from the mesh (scripts/extract_pine_extents.mjs);
 * the widest of the sector and its two neighbours is used so the wedge between sample directions stays covered.
 * `trim` shortens the reach if only the outermost needles should brush the body; 0 keeps them blocking (audit: 8 cm
 * trim gave 51 m of invisible wall and 5.5 m² of penetration, none 56 m and 5.2 m²; the old circle 235 m and 3.4 m²).
 */
export function pineReach(scale:number,yaw:number,angle:number,low:number,high:number,trim=0){
 const first=Math.max(0,Math.floor(low/scale/binHeight)),last=Math.min(extents.length-1,Math.floor(high/scale/binHeight))
 if(last<first)return 0
 // Instances turn about the vertical axis by yaw: a world direction a is kit angle a + yaw.
 const kit=((angle+yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)
 const s=Math.floor(kit/(Math.PI*2)*sectors)%sectors
 let reach=0
 for(let y=first;y<=last;y++)for(const k of [s-1,s,s+1])reach=Math.max(reach,extents[y][(k+sectors)%sectors])
 return Math.max(0,reach*scale-trim)
}
