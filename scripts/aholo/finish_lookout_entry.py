"""Cover the local gate separation ends; do not edit stairs or original faces."""
import bpy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
directory = ROOT / 'assets/lux3d/round-01/lookout'
evidence = ROOT / 'docs/evidence/assets/2026-10-22-round-01/lookout/structure-v3'
evidence.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(directory / 'structure-v2.blend'))
wood = bpy.data.materials.new('Entry end-grain timber')
wood.use_nodes = True
shader = wood.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (.34, .18, .075, 1)
shader.inputs['Roughness'].default_value = .8
for x in [-.305, .305]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, .51, .44))
    obj = bpy.context.object
    obj.name = 'Entry_cut_end_cover_' + ('hinge' if x > 0 else 'latch')
    obj.scale = (.065, .30, .43)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(wood)
    bevel = obj.modifiers.new('Timber edge', 'BEVEL')
    bevel.width = .012
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
bpy.ops.object.select_all(action='SELECT')
output = directory / 'structure-v3.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'structure-v3.blend'))
record = {'source': 'structure-v2.blend', 'output': output.relative_to(ROOT).as_posix(),
          'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'changes': 'Two timber end covers at separated gate edges',
          'characterModified': False, 'originalFacesDeleted': 0, 'stairsModified': False,
          'status': 'candidate; original stair path and player collision require runtime verification'}
(evidence / 'structure.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record))
