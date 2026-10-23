"""Local reversible tail-root clearance trial; preserves the Lux3D source file."""
import bpy
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
directory = ROOT / 'assets/lux3d/round-01/raccoon-multiview'
source = directory / 'output-1.glb'
parser=argparse.ArgumentParser()
parser.add_argument('--variant', choices=['tail-repair-v1','tail-repair-v2','tail-repair-v3','tail-repair-v4','tail-repair-v5'], default='tail-repair-v5')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
evidence = ROOT / 'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview' / args.variant
evidence.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
body.name = 'Raccoon_tail_clearance_trial'
original_vertices = len(body.data.vertices)
original_faces = len(body.data.polygons)
original_mesh=body.data.copy()

# Build a closed, tapered annular cutter in the review's three-unit coordinate
# system. Its central core is retained as the attachment to the pelvis; the
# surrounding band removes the fused skirt edge without changing the tail tip.
sections = [(-.10, .045, .048), (-.065, .045, .115),
            (.015, .060, .17), (.10, .085, .19),
            (.20, .12, .195), (.31, .17, .172)]
if args.variant=='tail-repair-v2':
    sections=[(-.045,.08,.081),(.01,.085,.115),(.10,.11,.14),(.18,.14,.165),(.24,.175,.176)]
count = 48
vertices = []
for y, inner, outer in sections:
    center_x = -.35 * max(y, 0)
    center_z = 1.365 - .5 * y
    for radius in [outer, inner]:
        for i in range(count):
            angle = 2 * math.pi * i / count
            normalized = Vector((center_x + radius*math.cos(angle), y,
                                 center_z + radius*math.sin(angle)))
            vertices.append(tuple((normalized - Vector((0,0,1.5))) / 5))
faces = []
for j in range(len(sections)-1):
    for ring in [0,1]:
        for i in range(count):
            a=j*count*2+ring*count+i
            b=j*count*2+ring*count+(i+1)%count
            face=(a,b,b+count*2,a+count*2)
            faces.append(face if ring==0 else tuple(reversed(face)))
for j in [0,len(sections)-1]:
    for i in range(count):
        a=j*count*2+i; b=j*count*2+(i+1)%count
        face=(a,a+count,b+count,b)
        faces.append(tuple(reversed(face)) if j==0 else face)
if args.variant in ['tail-repair-v3','tail-repair-v4','tail-repair-v5']:
    # Follow the existing V-shaped hem instead of punching a circular neck hole.
    rows=[(1.49,-.040,.030,.001),(1.45,-.060,.055,.014),
          (1.40,-.090,.100,.017),(1.35,-.120,.130,.017),
          (1.30,-.180,.145,.017),(1.24,-.240,.160,.018),
          (1.205,-.260,.165,.001)]
    if args.variant in ['tail-repair-v4','tail-repair-v5']:
        # Seam positions were measured by ray casting manually inspected pixels
        # of the source's saved orthographic back close-up, not estimated by color.
        rows=[(1.505,-.0172,.0517,.001),(1.452,-.0431,.0689,.010),
              (1.401,-.0775,.0896,.012),(1.350,-.1171,.1033,.012),
              (1.299,-.1619,.1171,.012),(1.248,-.2153,.1171,.012),
              (1.215,-.249,.1171,.001)]
    vertices=[];faces=[]
    for side in [1,2]:
        start=len(vertices)
        for z,left,right,width in rows:
            x=left if side==1 else right
            for px,py in [(x-width,-.04),(x+width,-.04),(x+width,.22),(x-width,.22)]:
                vertices.append(tuple((Vector((px,py,z))-Vector((0,0,1.5)))/5))
        for j in range(len(rows)-1):
            for k in range(4):
                a=start+j*4+k;b=start+j*4+(k+1)%4
                faces.append((a,b,b+4,a+4))
        faces.append(tuple(start+i for i in reversed(range(4))))
        faces.append(tuple(start+(len(rows)-1)*4+i for i in range(4)))
mesh=bpy.data.meshes.new('Local_tail_clearance_cutter')
mesh.from_pydata(vertices,[],faces);mesh.update()
cutter=bpy.data.objects.new('Local_tail_clearance_cutter',mesh)
bpy.context.collection.objects.link(cutter)
# Recalculate cutter winding only; the imported character is not welded or remeshed.
bpy.context.view_layer.objects.active=cutter
cutter.select_set(True);body.select_set(False)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
cut_material=bpy.data.materials.new('Tail_root_cut_surface_brown')
cut_material.use_nodes=True
shader=cut_material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value=(.09,.065,.048,1)
shader.inputs['Roughness'].default_value=.85
body.data.materials.append(cut_material)
cutter.data.materials.append(body.data.materials[0])
cutter.data.materials.append(cut_material)
for face in cutter.data.polygons: face.material_index=1
modifier=body.modifiers.new('Tail_and_skirt_clearance','BOOLEAN')
modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
modifier.use_self=args.variant not in ['tail-repair-v4','tail-repair-v5'];modifier.use_hole_tolerant=True
bpy.context.view_layer.objects.active=body
body.select_set(True);cutter.select_set(False)
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(cutter,do_unlink=True)
validation_corrected=body.data.validate(clean_customdata=False)
body.data.update()
preserved_source_faces=None
if args.variant=='tail-repair-v5':
    # Boolean classification on a scanned, nonmanifold mesh can discard tiny
    # disconnected details far from its cutter. Use the result only inside the
    # local edit box; copy every exterior source triangle and its UV/normals.
    changed_mesh=body.data
    materials=list(changed_mesh.materials)
    combined_vertices=[];combined_faces=[];uvs=[];normals=[];styles=[]
    preserved_source_faces=0
    for part,is_original in [(original_mesh,True),(changed_mesh,False)]:
        base=len(combined_vertices)
        combined_vertices.extend(tuple(v.co) for v in part.vertices)
        local=[]
        for v in part.vertices:
            x,y,z=v.co*5+Vector((0,0,1.5))
            local.append(-.31<=x<=.31 and -.12<=y<=.35 and 1.15<=z<=1.62)
        layer=part.uv_layers.active.data
        for polygon in part.polygons:
            touches=any(local[i] for i in polygon.vertices)
            if touches==is_original:
                continue
            if is_original: preserved_source_faces+=1
            combined_faces.append(tuple(base+i for i in polygon.vertices))
            styles.append((polygon.material_index,polygon.use_smooth))
            for loop in polygon.loop_indices:
                uvs.extend(layer[loop].uv)
                normals.append(tuple(part.corner_normals[loop].vector))
    combined=bpy.data.meshes.new('Original_with_local_tail_patch')
    combined.from_pydata(combined_vertices,[],combined_faces)
    combined.uv_layers.new(name='UVMap').data.foreach_set('uv',uvs)
    for material in materials: combined.materials.append(material)
    for polygon,(material_index,smooth) in zip(combined.polygons,styles):
        polygon.material_index=material_index;polygon.use_smooth=smooth
    combined.normals_split_custom_set(normals)
    combined.update()
    body.data=combined
output=directory/f'{args.variant}.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(directory/f'{args.variant}.blend'))
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
record={'status':'local-geometry-trial-awaiting-visual-review','sourceSha256':source_hash,
        'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'sourceModified':False,'paidApiCalls':0,'decimationApplied':False,
        'originalVertices':original_vertices,'originalFaces':original_faces,
        'outputVertices':len(body.data.vertices),'outputPolygons':len(body.data.polygons),
        'meshValidationCorrectedData':validation_corrected,
        'preservedSourceExteriorTriangles':preserved_source_faces,
        'method':('Two narrow V-shaped hem clearances; preserve central attachment' if args.variant in ['tail-repair-v3','tail-repair-v4','tail-repair-v5'] else 'Exact local tapered annular subtraction; preserve central pelvic attachment'),
        'cutterSectionsNormalized':sections,'runtimeBrowserVerified':False}
if args.variant in ['tail-repair-v3','tail-repair-v4','tail-repair-v5']:
    record.pop('cutterSectionsNormalized')
    record['cutterRowsNormalized']=rows
(evidence/'repair.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record))
