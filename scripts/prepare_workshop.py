"""Extract two existing props from a read-only historical Blender scene; no new modeling."""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('F:/Projects/my-blog/assets/blender/interiors/derived/workshop-interior.blend')
OUT=ROOT/'assets/workshop'; EVIDENCE=ROOT/'docs/evidence/2026-10-24-workshop'
OUT.mkdir(parents=True,exist_ok=True); EVIDENCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
records=[]
for kind,name in [('workbench','Hero_workshop-workbench'),('stool','Prop_workshop-stool')]:
    o=bpy.data.objects.get(name)
    if o is None: raise RuntimeError(f'Missing {name}; candidates: {[q.name for q in bpy.data.objects if kind in q.name]}')
    o.data=o.data.copy()
    triangles_before=sum(len(p.vertices)-2 for p in o.data.polygons)
    repaired=o.data.validate(verbose=True)
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(c) for c in o.bound_box]
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    o.matrix_world=Matrix.Translation((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2]))@o.matrix_world
    bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
    output=OUT/f'{kind}.glb'
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=False)
    records.append({'kind':kind,'sourceObject':name,'source':str(SOURCE),'dimensions':[high[i]-low[i] for i in range(3)],'trianglesBeforeValidation':triangles_before,'validatedRepair':repaired,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'materials':[m.name for m in o.data.materials],'output':output.relative_to(ROOT).as_posix(),'newGeometry':False})
result={'blender':bpy.app.version_string,'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'assets':records}
(EVIDENCE/'blender-extraction.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
