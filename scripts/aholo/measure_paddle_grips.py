"""Inspect actual palm/finger positions; no character or source writes."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-final';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/center-seat-v6.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=bpy.data.objects['Lux3D_Raccoon_MixamoSkin'];groups={g.index:g.name for g in body.vertex_groups}
records=[]
for frame in [0,75,100,170,180,190,200]:
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();r={'frame':frame,'bones':{},'hands':{}}
 for b in rig.pose.bones:
  if 'Hand' in b.name:r['bones'][b.name]={'head':list(rig.matrix_world@b.head),'tail':list(rig.matrix_world@b.tail),'matrix':[list(row) for row in rig.matrix_world@b.matrix]}
 for side in ['Left','Right']:
  ids=[v.index for v in body.data.vertices if sum(g.weight for g in v.groups if side+'Hand' in groups[g.group])>.5];v=[body.matrix_world@m.vertices[i].co for i in ids]
  r['hands'][side]={'bounds':[[min(p[a] for p in v),max(p[a] for p in v)] for a in range(3)],'vertices':len(v)}
 e.to_mesh_clear();records.append(r)
(OUT/'grip-measurements.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps([{**r,'bones':{n:{'head':b['head'],'tail':b['tail']} for n,b in r['bones'].items()}} for r in records if r['frame']==190]),flush=True)
