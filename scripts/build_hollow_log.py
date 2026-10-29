"""IE-02 original hollow log: thick open shell, bark relief and embedded moss; no decimation."""
import bpy, bmesh, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/expansion/hollow-log.glb'
WORK=ROOT/'assets/blender/hollow-log'
EVIDENCE=ROOT/'docs/evidence/2026-10-29-mist-logs'
for p in [OUT.parent,WORK,EVIDENCE]:p.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(4029);verts=[];faces=[];colours=[]
def face(points,col):
 start=len(verts);verts.extend(points);faces.append(tuple(range(start,len(verts))));colours.append(col)
def shape(x,a,extra=0):
 r=.44*(1-.07*x)+.016*math.sin(5*a+x)+.009*math.sin(19*a+x*3)+extra
 return Vector((x,math.cos(a)*r+.018*math.sin(x*1.8),.46+math.sin(a)*r+.015*math.cos(x*1.7)))
def end(side,a):return side*(1.45+.09*math.sin(a*7+.3)+.055*math.sin(a*13+1))
N=64;ROWS=18
# Continuous inner and outer walls, connected only by annular broken rims: no cap over either opening.
for j in range(ROWS):
 for i in range(N):
  a=i*math.tau/N;b=(i+1)*math.tau/N
  def point(t,angle,inside=False):
   x=end(-1,angle)*(1-t)+end(1,angle)*t
   return shape(x,angle,-.12 if inside else 0)
  for inside in [False,True]:
   points=[point(j/ROWS,a,inside),point((j+1)/ROWS,a,inside),point((j+1)/ROWS,b,inside),point(j/ROWS,b,inside)]
   if inside:points.reverse()
   tone=(.065,.028,.012) if inside else (.14,.063,.025)
   shade=.8+rng.random()*.35
   face(points,tuple(c*shade for c in tone))
for side in [-1,1]:
 for i in range(N):
  a=i*math.tau/N;b=(i+1)*math.tau/N
  for k in range(3):
   e=-.12*k/3;f=-.12*(k+1)/3
   points=[shape(end(side,a),a,e),shape(end(side,b),b,e),shape(end(side,b),b,f),shape(end(side,a),a,f)]
   if side<0:points.reverse()
   shade=(.65 if k==1 else .9)+rng.random()*.25
   face(points,tuple(c*shade for c in (.34,.17,.065)))
# Two short snapped branch stubs, grown out of the upper wall and capped with exposed wood.
for x,a,length in [(-.55,1.3,.43),(.87,1.9,.25)]:
 origin=shape(x,a,-.045);axis=Vector((-.18,math.cos(a),math.sin(a))).normalized()
 u=axis.cross(Vector((1,0,0))).normalized();v=axis.cross(u)
 for i in range(12):
  t=i*math.tau/12;s=(i+1)*math.tau/12
  p=origin+(u*math.cos(t)+v*math.sin(t))*.115;q=origin+(u*math.cos(s)+v*math.sin(s))*.115
  r=origin+axis*(length+.035*math.sin(s*5))+(u*math.cos(s)+v*math.sin(s))*.075
  w=origin+axis*(length+.035*math.sin(t*5))+(u*math.cos(t)+v*math.sin(t))*.075
  face([p,q,r,w],(.16,.075,.029));face([w,r,origin+axis*length],(.31,.15,.05))
mat=bpy.data.materials.new('Warm bark, dark inner wood and olive moss');mat.use_nodes=True
bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Roughness'].default_value=.93
node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Col';mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
def make(name):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
 for poly,tone in zip(mesh.polygons,colours):
  for k in poly.loop_indices:col.data[k].color=(*tone,1)
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 mesh.materials.append(mat);obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);return obj
obj=make('Hollow_Log')
# Fixed studio scene is retained between the structural draft and the detailed version.
bpy.ops.mesh.primitive_plane_add(size=20,location=(0,0,-.025));floor=bpy.context.object
fm=bpy.data.materials.new('Review ground');fm.diffuse_color=(.43,.45,.40,1);floor.data.materials.append(fm)
bpy.ops.object.light_add(type='AREA',location=(-3,-4,6));bpy.context.object.data.energy=650;bpy.context.object.data.size=4
bpy.ops.object.camera_add(location=(-4.6,-3.6,2.7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.1
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('Review world');scene.world.color=(.38,.38,.38)
scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.filepath=str(EVIDENCE/'log-blender-first.png');bpy.ops.render.render(write_still=True)
first_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
bpy.data.objects.remove(obj,do_unlink=True)
# Staggered raised bark scales follow the shell, with dark narrow cracks between them.
for row in range(13):
 x=-1.34+row*.217
 for i in range(36):
  a=(i+(row%2)*.45)*math.tau/36
  if math.sin(a)<-.78:continue
  xj=x+rng.uniform(-.06,.06)
  length=.19+rng.random()*.19;width=.10+rng.random()*.065
  xa=max(-1.39,xj-length*.45);xb=min(1.40,xj+length*.45)
  aa=a-width/2;ab=a+width/2
  outline=[shape(xa,aa,.004),shape(xb,aa+.02,.009),shape(xb+.035,ab,.006),shape(xa+.025,ab,.005)]
  centre=shape((xa+xb)/2,a,.012+rng.random()*.012)
  shade=.78+rng.random()*.48
  tone=tuple(c*shade for c in (.175,.083,.032))
  for k in range(4):face([outline[k],outline[(k+1)%4],centre],tone)
# Moss rests on the bark in broken bands, never floating over the hollow opening.
moss_start=len(faces)
for px,pa in [(-1.1,1.4),(-.85,2.3),(-.35,1.2),(.2,1.6),(.65,2.5),(1.1,1.2)]:
 for i in range(44):
  x=px+rng.uniform(-.24,.24);a=pa+rng.uniform(-.35,.35)
  centre=shape(x,a,.022);normal=Vector((0,math.cos(a),math.sin(a)))
  u=Vector((1,0,0));v=Vector((0,-math.sin(a),math.cos(a)))
  rx=rng.uniform(.035,.09);ry=rng.uniform(.025,.065);high=rng.uniform(.01,.027)
  outer=[centre+u*(math.cos(k*math.tau/10)*rx)+v*(math.sin(k*math.tau/10)*ry) for k in range(10)]
  inner=[centre+normal*high*.8+u*(math.cos(k*math.tau/10)*rx*.57)+v*(math.sin(k*math.tau/10)*ry*.57) for k in range(10)]
  top=centre+normal*high
  shade=rng.uniform(.78,1.2);tone=tuple(c*shade for c in (.095,.125,.023))
  for k in range(10):
   face([outer[k],outer[(k+1)%10],inner[(k+1)%10],inner[k]],tone)
   face([inner[k],inner[(k+1)%10],top],tone)
obj=make('Hollow_Log')
for poly in obj.data.polygons[moss_start:]:poly.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_vertex_color='NAME',export_vertex_color_name='Col',export_all_vertex_colors=False)
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'hollow-log.blend'))
obj.data.calc_loop_triangles()
# Ray through the axis must exit both open ends without touching a lid.
hit,_,_,_=obj.ray_cast(Vector((-3,0,.46)),Vector((1,0,0)),distance=6)
assert not hit,'The hollow passage is capped'
summary={'source':'Original Blender geometry guided by approved IE-02; no reference texture copied','blender':bpy.app.version_string,'triangles':len(obj.data.loop_triangles),'draftTriangles':first_triangles,'sizeBlenderXYZ':list(obj.dimensions),'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'openAxisRay':not hit,'wallThickness':.12,'materials':1,'textures':0,'paidCalls':0,'decimated':False}
(EVIDENCE/'log-validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
scene.render.filepath=str(EVIDENCE/'log-blender.png');bpy.ops.render.render(write_still=True)
cam.location=(4.6,-3.6,2.7);cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(EVIDENCE/'log-blender-rear.png');bpy.ops.render.render(write_still=True)
print(json.dumps(summary))
