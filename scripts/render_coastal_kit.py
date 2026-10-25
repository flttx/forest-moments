"""Review render of public/assets/expansion/coastal-kit.glb: all modules in a row, workbench + vertex colour."""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
out = Path(sys.argv[-1]) if sys.argv[-1].endswith('.png') else ROOT / 'docs/evidence/2026-10-25-visual-v3/coastal-kit-lineup.png'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/expansion/coastal-kit.glb'))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
x = 0
for o in sorted(meshes, key=lambda o: o.name):
    o.location = (x + o.dimensions.x / 2, 0, 0); x += o.dimensions.x + .6
bpy.ops.mesh.primitive_plane_add(size=40, location=(x / 2, 0, 0))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
shading = scene.display.shading
shading.light = 'STUDIO'; shading.color_type = 'VERTEX'; shading.show_shadows = True; shading.show_cavity = True
scene.render.resolution_x, scene.render.resolution_y = 1600, 700
cam = bpy.data.cameras.new('review'); c = bpy.data.objects.new('review', cam); scene.collection.objects.link(c); scene.camera = c
c.location = (x / 2, -15, 6)
c.rotation_euler = (Vector((x / 2, 0, .8)) - c.location).to_track_quat('-Z', 'Y').to_euler()
cam.lens = 32
scene.render.filepath = str(out)
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.render.render(write_still=True)
print('rendered', out)
