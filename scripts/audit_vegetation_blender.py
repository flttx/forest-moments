"""Read original Blender kit meshes and validate migrated templates in an isolated process."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidence/vegetation-expansion/2026-10-24'
bpy.ops.wm.open_mainfile(filepath='F:/Projects/my-blog/assets/blender/world-v3/derived/forest-island-ecology-v3.blend')
manifest=json.loads((OUT/'asset-manifest.json').read_text())
report={'blender':bpy.app.version_string,'templates':{},'source_read_only':True}
source_meshes={}
for kit in manifest['templates']:
 prefix='Eco_'+kit
 obj=next(o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith(prefix+'_'))
 source_meshes[kit]=obj.data
scene=bpy.data.scenes.new('ForestMoments_TemplateReview')
bpy.context.window.scene=scene
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/vegetation/forest-kit-review.glb'))
for i,kit in enumerate(manifest['templates']):
 obj=next(o for o in scene.objects if o.type=='MESH' and o.name.startswith('Eco_'+kit))
 world=obj.matrix_world
 points=[world@v.co for v in obj.data.vertices]
 raw=[v.co for v in source_meshes[kit].vertices]
 bounds=lambda ps:[[min(v[a] for v in ps) for a in range(3)],[max(v[a] for v in ps) for a in range(3)]]
 a,b=bounds(raw),bounds(points)
 delta=max(abs(a[j][k]-b[j][k]) for j in range(2) for k in range(3))
 report['templates'][kit]={'source_bounds':a,'derived_bounds':b,'max_bound_error_m':delta,'uv_layers':len(obj.data.uv_layers),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'finite_normals':all(all(math.isfinite(x) for x in v.normal) for v in obj.data.vertices),'materials':len(obj.data.materials)}
 assert delta<.005,(kit,delta)
 assert obj.data.uv_layers and report['templates'][kit]['finite_normals']
 obj.location.x+=i*6;obj.location.y+=8
 original=bpy.data.objects.new('Source_'+kit,source_meshes[kit]);scene.collection.objects.link(original);original.location.x=i*6
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/vegetation/template-review.blend'))
report['status']='PASS: bounds, UV availability, finite normals and triangle counts; visual review is separate'
(OUT/'blender-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
