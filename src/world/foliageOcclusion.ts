type Point={x:number;y:number;z:number}
export type FoliageOccluder={center:Point;radius:Point;hidden:boolean;visibility:number}

/** Test the whole crown against the sight line; hysteresis prevents edge flicker. */
export function updateFoliageOcclusion(tree:FoliageOccluder,camera:Point,focus:Point,dt:number){
  const {center:c,radius:r}=tree
  const ax=(camera.x-c.x)/r.x,ay=(camera.y-c.y)/r.y,az=(camera.z-c.z)/r.z
  const dx=(focus.x-camera.x)/r.x,dy=(focus.y-camera.y)/r.y,dz=(focus.z-camera.z)/r.z
  const length=dx*dx+dy*dy+dz*dz
  const along=length>1e-8?-(ax*dx+ay*dy+az*dz)/length:0
  const t=Math.max(0,Math.min(1,along))
  const distance=Math.hypot(ax+dx*t,ay+dy*t,az+dz*t)
  tree.hidden=distance<(tree.hidden?1.15:1)
  const step=Math.max(0,Math.min(dt,.05))/.18
  tree.visibility=tree.hidden?Math.max(0,tree.visibility-step):Math.min(1,tree.visibility+step)
}
