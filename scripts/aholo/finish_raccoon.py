"""Refine the repaired raccoon's surface response and sample color onto cut faces."""
import bpy
import hashlib
import json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
directory=ROOT/'assets/lux3d/round-01/raccoon-multiview'
source=directory/'tail-repair-v5.glb'
output=directory/'surface-v1.glb'
evidence=ROOT/'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview/surface-v1'
evidence.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
mesh=body.data
base=mesh.materials[0]
bsdf=next(n for n in base.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
image_node=bsdf.inputs['Base Color'].links[0].from_node
texture=image_node.image
width,height=texture.size
pixels=np.empty(width*height*4,dtype=np.float32)
texture.pixels.foreach_get(pixels)
pixels=pixels.reshape(height,width,4)
uvs=mesh.uv_layers.active.data

def sample(uv):
    x=int(max(0,min(width-1,uv.x*width)))
    y=int(max(0,min(height-1,uv.y*height)))
    return pixels[y,x,:3]

source_faces=[p for p in mesh.polygons if p.material_index==0]
tree=BVHTree.FromPolygons([v.co for v in mesh.vertices],[tuple(p.vertices) for p in source_faces],all_triangles=True)
colors=mesh.color_attributes.new(name='RepairColor',type='FLOAT_COLOR',domain='CORNER')
color_values=np.ones((len(mesh.loops),4),dtype=np.float32)
cut_faces=[p for p in mesh.polygons if p.material_index!=0]
for polygon in cut_faces:
    for loop_index in polygon.loop_indices:
        point=mesh.vertices[mesh.loops[loop_index].vertex_index].co
        nearest,_,face_index,_=tree.find_nearest(point)
        face=source_faces[face_index]
        vertices=[mesh.vertices[i].co for i in face.vertices]
        texcoords=[Vector((*uvs[i].uv,0)) for i in face.loop_indices]
        uv=barycentric_transform(nearest,*vertices,*texcoords)
        color_values[loop_index,:3]=sample(uv)
colors.data.foreach_set('color',color_values.ravel())

materials=[]
for name,roughness,metallic in [('Fur',.82,0),('Cloth',.86,0),('Leather',.57,0),('Eyes',.23,0),('Buckle',.48,.25)]:
    material=base.copy();material.name='Raccoon_'+name
    shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    for channel,value in [('Roughness',roughness),('Metallic',metallic)]:
        for link in list(shader.inputs[channel].links):material.node_tree.links.remove(link)
        shader.inputs[channel].default_value=value
    materials.append(material)
cut=bpy.data.materials.new('Tail_root_sampled_color')
cut.use_nodes=True
shader=cut.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value=.82
color_node=cut.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='RepairColor'
cut.node_tree.links.new(color_node.outputs['Color'],shader.inputs['Base Color'])
materials.append(cut)
old_indices=[p.material_index for p in mesh.polygons]
mesh.materials.clear()
for material in materials:mesh.materials.append(material)
counts={m.name:0 for m in materials}
for polygon,old_index in zip(mesh.polygons,old_indices):
    if old_index:
        category=5
    else:
        center=sum((mesh.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)
        x,y,z=body.matrix_world@center*5+Vector((0,0,1.5))
        uv=sum((uvs[i].uv for i in polygon.loop_indices),Vector((0,0)))/len(polygon.loop_indices)
        r,g,b=sample(uv)
        green=g>r*1.02 and g>b*1.20
        category=1 if green or (1.52<z<2.13 and abs(x)<.5) else 0
        if z<.30 or 1.49<z<1.59:category=2
        if y<-.16 and ((abs(x)-.145)/.10)**2+((z-2.57)/.085)**2<1:category=3
        if y<-.20 and abs(x)<.075 and 1.48<z<1.58:category=4
    polygon.material_index=category
    counts[materials[category].name]+=1
bpy.context.view_layer.objects.active=body
body.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(directory/'surface-v1.blend'))
record={'source':source.relative_to(ROOT).as_posix(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'output':output.relative_to(ROOT).as_posix(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'geometryModified':False,'texturePaintingPerformed':False,'method':'Per-region PBR response; nearest surface color sampled onto new cut faces as vertex colors',
        'materialFaceCounts':counts,'sourceMetallicRoughnessMapReplacedByParameters':True,
        'status':'awaiting visual review','paidApiCalls':0,'runtimeBrowserVerified':False}
(evidence/'surface.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record))
