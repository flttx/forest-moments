// Runs only in the development browser QA harness. Vertical parity against the actual
// bench triangles, with a spatial grid; samples all posed character vertices.
export function auditSeatContact(THREE,scene,seat){
  scene.updateMatrixWorld(true)
  let bench;scene.traverse(o=>{if(o.name==='expansion-low-bench'&&Math.hypot(o.position.x-seat.x,o.position.z-seat.z)<.01)bench=o})
  const actor=scene.getObjectByName('asset-raccoon'),grid=new Map(),cell=.08,box=new THREE.Box3().setFromObject(bench)
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),p=new THREE.Vector3()
  bench.traverse(o=>{
    if(!o.isMesh)return
    const pos=o.geometry.attributes.position,idx=o.geometry.index
    for(let i=0;i<(idx?.count??pos.count);i+=3){
      a.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld)
      b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(o.matrixWorld)
      c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(o.matrixWorld)
      const det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-9)continue
      const tri=[a.clone(),b.clone(),c.clone(),det]
      for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/cell);z++){
        const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(tri)
      }
    }
  })
  const regions={},support=[]
  actor.traverse(o=>{
    if(!o.isSkinnedMesh)return
    o.skeleton.update()
    const {position,skinIndex,skinWeight}=o.geometry.attributes
    for(let i=0;i<position.count;i++){
      o.getVertexPosition(i,p).applyMatrix4(o.matrixWorld)
      if(!box.containsPoint(p))continue
      let weight=-1,bone='unknown';for(let n=0;n<4;n++){const w=skinWeight.getComponent(i,n);if(w>weight){weight=w;bone=o.skeleton.bones[skinIndex.getComponent(i,n)].name}}
      const hits=[]
      for(const [a,b,c,det] of grid.get(`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`)??[]){
        const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/det,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/det
        if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)hits.push(u*a.y+v*b.y+(1-u-v)*c.y)
      }
      hits.sort((a,b)=>a-b);const ys=hits.filter((y,i)=>!i||y-hits[i-1]>.0001)
      for(let n=0;n+1<ys.length;n+=2){
        const bottom=ys[n],top=ys[n+1]
        if(p.y>bottom&&p.y<top){const depth=Math.min(p.y-bottom,top-p.y);if(depth>.003){const key=o.material.name+':'+bone,r=regions[key]??={vertices:0,maxDepth:0};r.vertices++;if(depth>r.maxDepth){r.maxDepth=depth;r.point=p.toArray();r.interval=[bottom,top]}}}
        if(/Hips|UpLeg/.test(bone)&&top-box.min.y>.25&&top-box.min.y<.45&&p.y>=top)support.push(p.y-top)
      }
    }
  })
  return {tolerance:.003,regions,maxDepth:Math.max(0,...Object.values(regions).map(r=>r.maxDepth)),supportGap:support.length?Math.min(...support):null}
}
