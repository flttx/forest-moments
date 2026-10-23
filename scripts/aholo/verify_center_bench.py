"""Verify retained hull geometry/UV, source actor and authored poses independently."""
import bpy,json,hashlib,array
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final'
c=json.loads((OUT/'candidate.json').read_text())
def geometry(o):
 uv=o.data.uv_layers.active;world=o.matrix_world
 result=Counter();locations={}
 for p in o.data.polygons:
  points=[world@o.data.vertices[i].co for i in p.vertices]
  key=(p.material_index,tuple(sorted(tuple(round(x,6) for x in point)+tuple(round(x,6) for x in uv.data[li].uv) for point,li in zip(points,p.loop_indices))))
  result[key]+=1;locations[key]=(points,sum(v.x for v in points)/len(points),sum(v.y for v in points)/len(points))
 return result,locations
def actor(o):
 return hashlib.sha256(str(([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons],[[tuple((g.group,g.weight)) for g in v.groups] for v in o.data.vertices])).encode()).hexdigest()
def images(o):
 result={}
 for mat in o.data.materials:
  for node in mat.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image:
    img=node.image;a=array.array('f',[0])*len(img.pixels);img.pixels.foreach_get(a);result[img.name]={'size':list(img.size),'sha256':hashlib.sha256(a.tobytes()).hexdigest()}
 return result
def poses():
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');h=hashlib.sha256()
 assert not any(b.constraints for b in rig.pose.bones)
 for f in range(217):
  bpy.context.scene.frame_set(f);bpy.context.view_layer.update()
  h.update(str([[round(x,7) for row in b.matrix_basis for x in row] for b in rig.pose.bones]).encode())
 return h.hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
before,locations=geometry(bpy.data.objects['Lux3D_canoe']);textures=images(bpy.data.objects['Lux3D_canoe']);skin=actor(bpy.data.objects['Lux3D_Raccoon_MixamoSkin']);pose_hash=poses()
bpy.ops.wm.open_mainfile(filepath=str((ROOT/c['asset'].lstrip('/')).with_suffix('.blend')))
after,_=geometry(bpy.data.objects['Lux3D_canoe']);assert not(after-before),'Retained hull changed'
removed=before-after
for key in removed:
 points,x,y=locations[key];assert -.2<x<.34 and abs(y)<.30 and min(v.z for v in points)>-.28 and max(v.z for v in points)<-.065
assert sum(removed.values())==c['interiorBenchFacesRemoved']
assert images(bpy.data.objects['Lux3D_canoe'])==textures
assert actor(bpy.data.objects['Lux3D_Raccoon_MixamoSkin'])==skin
assert poses()==pose_hash
report={'asset':c['asset'],'sha256':c['outputSHA256'],'retainedHullFacesWithPositionsAndUV':sum(after.values()),'removedFacesOnlyInsideDeclaredBenchRegion':sum(removed.values()),'hullTexturePixels':textures,'actorMeshTopologyWeightsPreserved':True,'sourcePaddlePoseSamplesPreserved':217,'poseDigest':pose_hash,'scope':'Blender geometry and original poses; visual and collision acceptance separate'}
(OUT/'scope-verification.json').write_text(json.dumps(report,indent=2)+'\n');print('CENTER_SCOPE',json.dumps(report),flush=True)
