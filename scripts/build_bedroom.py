import bpy,math,random
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(25)
def mat(name,color,rough=.85):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=rough;return m
oak=[mat('Warm oak '+str(i),(.27+i*.012,.14+i*.009,.065+i*.006)) for i in range(6)]
plaster=mat('Warm lime plaster',(.65,.56,.40));dark=mat('Dark structural timber',(.12,.065,.032));rug=mat('Sage woven rug',(.19,.26,.16));cream=mat('Rug border',(.55,.47,.3))
def box(name,loc,size,m,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Soft worn edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
# Blender XY is runtime X/-Z, Z is height. Floor fully overlaps wall bottoms.
for row in range(20):
 for col in range(4):box('Floor plank',(-3+col*2+(row%2)*.0,-2.85+row*.3,-.065),(1.99,.294,.13),random.choice(oak),.006)
for x in [-4,4]:box('Side plaster wall',(x,0,1.75),(.16,6,3.5),plaster)
box('North plaster wall',(0,3,1.75),(8,.16,3.5),plaster)
for x in [-2.45,2.45]:box('South door wall',(x,-3,1.75),(3.1,.16,3.5),plaster)
box('Door lintel',(0,-3,3.0),(1.85,.22,1),dark)
for x in [-3.9,3.9]:
 for y in [-2.9,0,2.9]:box('Timber post',(x,y,1.75),(.16,.18,3.5),dark)
for y in [-2.9,2.9]:
 for z in [.09,2.6,3.4]:box('Cross beam',(0,y,z),(8,.18,.16),dark)
for x in [-3.9,3.9]:
 for z in [.09,3.4]:box('Side beam',(x,0,z),(.18,6,.16),dark)
box('Woven rug border',(0,-.4,.012),(2.3,2.6,.025),cream,.01)
box('Woven rug field',(0,-.4,.027),(2.13,2.43,.012),rug,.01)
for i in range(17):box('Woven stripe',(-1+i*.125,-.4,.035),(.012,2.4,.003),cream,0)
# North window with a pale sky panel and timber mullions.
glass=mat('Window dawn',(.34,.48,.5));bs=glass.node_tree.nodes['Principled BSDF'];bs.inputs['Emission Color'].default_value=(.26,.38,.40,1);bs.inputs['Emission Strength'].default_value=.4
box('Window light',(0,2.90,1.95),(1.8,.08,1.3),glass)
for x in [-.95,0,.95]:box('Window upright',(x,2.82,1.95),(.075,.13,1.5),dark)
for z in [1.2,1.95,2.7]:box('Window crosspiece',(0,2.82,z),(2,.13,.075),dark)
for x in [-1.25,1.25]:box('Sage linen curtain',(x,2.74,1.95),(.45,.13,1.65),rug,.05)
box('Window sill',(0,2.69,1.18),(2.7,.45,.09),oak[2])
# Solid ceiling closes the room above the maximum indoor camera height.
box('Plaster ceiling',(0,0,3.57),(8.16,6.16,.14),plaster)
for x in [-2,0,2]:box('Ceiling oak beam',(x,0,3.43),(.16,6,.18),dark)
Path('assets/expansion').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(Path('assets/expansion/bedroom-shell.blend').resolve()))
bpy.ops.export_scene.gltf(filepath=str(Path('public/assets/expansion/bedroom-shell.glb').resolve()),export_format='GLB',export_animations=False)
print('BEDROOM_SHELL_EXPORTED',len(bpy.data.objects))
