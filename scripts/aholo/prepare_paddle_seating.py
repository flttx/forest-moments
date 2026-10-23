"""Make a separate review seat; leave every delivered asset untouched."""
import bpy
import json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/assets/2026-10-23-paddle-layout'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lux3d/round-01/canoe/assembly-review-v2.blend'))
scene=bpy.context.scene;scene.frame_set(0)
shift=Vector((-.6,-.2,.4))
character=bpy.data.objects['ASSEMBLY_ONLY_character'];character.location+=shift
bpy.context.view_layer.update()
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
tree=BVHTree.FromPolygons([body.matrix_world@v.co for v in m.vertices],[tuple(p.vertices) for p in m.polygons])
e.to_mesh_clear()
hits=[]
for x in [-.72,-.65,-.58,-.51]:
    for y in [-.32,-.24,-.16,-.08]:
        p=tree.ray_cast(Vector((x,y,-.5)),Vector((0,0,1)))[0]
        if p:hits.append(list(p))
print('SEAT_UNDERSIDE',json.dumps(hits),flush=True)
material=bpy.data.materials.new('Review_seat_warm_wood');material.diffuse_color=(.25,.115,.045,1)
material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.25,.115,.045,1);bsdf.inputs['Roughness'].default_value=.85
seat=[]
def beam(name,center,size):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=o.modifiers.new('Soft wood edges','BEVEL');bevel.width=.008;bevel.segments=2
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
    o.data.materials.append(material);seat.append(o)
beam('Review_seat_top',(-.56,-.17,.2925),(.34,.56,.035))
for x in [-.68,-.44]:
    for y in [-.38,.04]:beam('Review_seat_support',(x,y,.035),(.045,.045,.50))
beam('Review_seat_lower_brace',(-.56,-.17,-.12),(.30,.045,.045))
bpy.ops.object.select_all(action='DESELECT')
for o in seat:o.select_set(True)
out_glb=ROOT/'assets/lux3d/round-01/canoe/layout-seat-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out_glb),export_format='GLB',use_selection=True,export_animations=False)
(OUT/'layout-config.json').write_text(json.dumps({'status':'not adopted: high seat appearance and seat/body/paddle intersections unresolved','boatScale':.5,'characterShift':list(shift),'waterZ':-.14,'seatTopZ':.31,'seatAsset':'/assets/lux3d/round-01/canoe/layout-seat-review.glb','sourceTrack':'../2026-10-23-paddle-prop/prop-track.json'},indent=2)+'\n')
