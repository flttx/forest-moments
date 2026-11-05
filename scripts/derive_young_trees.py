"""Derive young forms of the AHOLO old pine, birch and maple in an isolated Blender process.

A young tree is not the adult scaled down: its trunk is thinner for its height, the clear bole is shorter, the crown is
narrower (the pine turns conical) and the leaf masses are smaller, so twigs show between them. Leaf pads move rigidly
to their reshaped attachment and shrink about their own centre, so their normals keep direction; bark and boughs bend
continuously and their custom normals follow the deformation by its Jacobian. Every face, UV and the material are kept.
"""
import bpy, json, math, hashlib, sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'assets/blender/young-trees'
EVIDENCE=ROOT/'docs/evidence/2026-11-04-young-trees'
for p in [WORK,EVIDENCE]:p.mkdir(parents=True,exist_ok=True)

# height: final metres; trunk: girth relative to a uniformly scaled adult; crown: (relative height, bough length) taper;
# bole/boleScale: source height of the crown base and how much the clear bole shortens; pad: leaf mass size factor.
# leaf: the texel test the runtime material uses for that asset (green over red for conifers, painted chroma for broadleaf).
FORMS={
 'young-pine':{'source':'old-pine','taskId':4461967,'height':4.6,'trunk':.42,'crown':((0,.62),(.55,.5),(1,.3)),'bole':1.44,'boleScale':.75,'pad':.72,'leaf':'green'},
 'young-birch':{'source':'birch','height':4.0,'trunk':.58,'crown':((0,.6),(.6,.56),(1,.46)),'bole':1.3,'boleScale':.8,'pad':.8,'leaf':(.22,.46)},
 'young-maple':{'source':'maple','height':3.7,'trunk':.55,'crown':((0,.68),(.6,.62),(1,.5)),'bole':1.2,'boleScale':.85,'pad':.8,'leaf':(.56,.7)},
}
only=[a for a in sys.argv[sys.argv.index('--')+1:] if not a.startswith('-')] if '--' in sys.argv else []

def smooth(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
def taper(points,t):
 for (t0,v0),(t1,v1) in zip(points,points[1:]):
  if t<=t1:return v0+(v1-v0)*smooth(t0,t1,t)
 return points[-1][1]

def setup_render(scale):
 scene=bpy.context.scene
 scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
 scene.render.resolution_x=scene.render.resolution_y=900;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='Standard'
 world=bpy.data.worlds.new('Review');world.use_nodes=True
 world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.8,.8,1)
 world.node_tree.nodes['Background'].inputs[1].default_value=.7;scene.world=world
 sun=bpy.data.objects.new('Review key',bpy.data.lights.new('Review key','SUN'))
 sun.data.energy=2.6;sun.rotation_euler=(.7,-.4,-.6);scene.collection.objects.link(sun)
 camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'))
 camera.data.type='ORTHO';camera.data.ortho_scale=scale;scene.collection.objects.link(camera);scene.camera=camera
 return scene,camera
def render(scene,camera,name,angle,height):
 centre=Vector((0,0,height/2));camera.location=centre+Vector((math.sin(angle),-math.cos(angle),.1))*16
 camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(EVIDENCE/name);bpy.ops.render.render(write_still=True)

summaries={};templates={}
for name,F in FORMS.items():
 if only and name not in only:continue
 source=ROOT/f'public/assets/island-trees/{F["source"]}.glb'
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(source))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1
 tree=meshes[0];m=tree.data
 transform=tree.matrix_world.copy();tree.parent=None;tree.matrix_world.identity();m.transform(transform)
 top=max(v.co.z for v in m.vertices);u=F['height']/top

 # Leaf texels, classified the way the runtime shader does it.
 image=[n.image for n in m.materials[0].node_tree.nodes if n.type=='TEX_IMAGE'][0]
 w,h=image.size;px=np.empty(w*h*4,np.float32);image.pixels.foreach_get(px);px=px.reshape(h,w,4)[...,:3]
 if F['leaf']=='green':leafTexel=np.clip((px[...,1]-px[...,0]+.02)/.06,0,1)
 else:
  hi=px.max(-1);lo=px.min(-1);sat=(hi-lo)/np.maximum(hi,1e-3);lo_s,hi_s=F['leaf']
  leafTexel=np.clip(((px[...,1]-px[...,2])/np.maximum(hi,1e-3)-.02)/.04,0,1)*np.clip((sat-lo_s)/(hi_s-lo_s),0,1)
 uv=np.empty(len(m.loops)*2,np.float32);m.uv_layers.active.data.foreach_get('uv',uv);uv=uv.reshape(-1,2)
 vi=np.empty(len(m.loops),np.int32);m.loops.foreach_get('vertex_index',vi)
 cornerLeaf=leafTexel[np.clip((uv[:,1]*h).astype(int),0,h-1),np.clip((uv[:,0]*w).astype(int),0,w-1)]>.5
 votes=np.bincount(vi,weights=cornerLeaf,minlength=len(m.vertices));count=np.maximum(np.bincount(vi,minlength=len(m.vertices)),1)
 original=[v.co.copy() for v in m.vertices]
 leaf=(votes>count*.5)&np.array([p.z>F['bole']*.7 for p in original])
 parent=list(range(len(m.vertices)))
 def find(a):
  while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
  return a
 for e in m.edges:
  a,b=e.vertices
  if leaf[a] and leaf[b]:parent[find(a)]=find(b)
 pads={}
 for i in range(len(original)):
  if leaf[i]:pads.setdefault(find(i),[]).append(i)
 # A pad far larger than a leaf mass is a shared sheet; let it bend with the crown instead of moving rigidly.
 extent={k:max((original[i]-original[idx[0]]).length for i in idx[::max(1,len(idx)//24)]) for k,idx in pads.items()}
 large=[k for k in pads if extent[k]>1.4]
 for k in large:del pads[k]
 padCentre={k:sum((original[i] for i in idx),Vector())/len(idx) for k,idx in pads.items()}
 padOf={i:k for k,idx in pads.items() for i in idx}
 normals=[Vector(c.vector) for c in m.corner_normals]
 sourceStats={'triangles':sum(len(p.vertices)-2 for p in m.polygons),'vertices':len(m.vertices)}

 bole=F['bole'];lowered=bole*F['boleScale'];stretch=(top-lowered)/(top-bole)
 def shape(p):
  """Source point (Blender Z-up) -> young tree point in final metres."""
  x,y,z=p.x,p.y,p.z
  t=max(0,min(1,(z-bole)/(top-bole)))
  s=z*F['boleScale'] if z<bole else lowered+(z-bole)*stretch
  r=math.hypot(x,y);a=math.atan2(y,x)
  bough=smooth(.25,1.1,r)*smooth(bole*.5,bole*1.1,z)
  k=F['trunk']+(taper(F['crown'],t)-F['trunk'])*bough
  k*=1+.1*math.sin(2*a+3*t)*bough  # uneven bough lengths, so the young crown is not a lathe
  x*=k;y*=k
  x+=.05*t*t*top;y-=.03*t*t*top  # slight lean of the leader
  return Vector((x*u,y*u,s*u))
 jac=[];eps=1e-3
 for i,(v,p) in enumerate(zip(m.vertices,original)):
  if i in padOf:
   c=padCentre[padOf[i]];q=shape(c)+(p-c)*u*F['pad'];jac.append(Matrix.Identity(3))
  else:
   q=shape(p)
   cols=[(shape(p+Vector(e)*eps)-q)/eps for e in ((1,0,0),(0,1,0),(0,0,1))]
   jac.append(Matrix((cols[0],cols[1],cols[2])).transposed().inverted_safe().transposed())
  v.co=q
 m.normals_split_custom_set([(jac[m.loops[li].vertex_index]@normals[li]).normalized() for poly in m.polygons for li in poly.loop_indices])
 m.validate();m.update();bpy.context.view_layer.update()
 tree.name=name.replace('-','_').title()
 height=max(v.co.z for v in m.vertices)

 # Same height, same framing: the uniformly scaled adult beside the derived form.
 scene,camera=setup_render(height*1.25)
 derived=[v.co.copy() for v in m.vertices]
 for v,p in zip(m.vertices,original):v.co=p*u
 m.update()
 render(scene,camera,f'{name}-uniform-front.png',.45,height)
 for v,p in zip(m.vertices,derived):v.co=p
 m.update()
 for view,angle in [('front',.45),('side',math.pi/2+.45),('back',math.pi+.45)]:render(scene,camera,f'{name}-{view}.png',angle,height)
 vertices=[v.co.copy() for v in m.vertices]  # copies: Blender may reallocate mesh data under live references

 bpy.ops.object.select_all(action='DESELECT');tree.select_set(True);bpy.context.view_layer.objects.active=tree
 out=WORK/f'{name}.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_image_format='AUTO')
 bpy.ops.wm.save_as_mainfile(filepath=str(WORK/f'{name}.blend'))
 trunk=max(math.hypot(v.x,v.y) for v in vertices if .25<v.z<min(1.0,lowered*u*.9))
 crownLow=lowered*u
 crownR=max(math.hypot(v.x,v.y) for v in vertices if v.z>crownLow)
 summaries[name]={'form':F,'sourceHeight':top,'uniformScale':u,'height':height,'trunkRadius':trunk,'uniformTrunkRadius':max(math.hypot(p.x,p.y) for p in original if .25/u<p.z<min(1.0,lowered*u*.9)/u)*u,
  'crownBase':crownLow,'crownRadius':crownR,'leafPads':len(pads),'sheetPadsLeftToBend':len(large),'leafVertices':int(leaf.sum()),
  'triangles':sum(len(p.vertices)-2 for p in m.polygons),'vertices':len(vertices),'materials':len(m.materials),'uvLayers':len(m.uv_layers),
  'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'candidate':str(out.relative_to(ROOT))}
 assert summaries[name]['triangles']==sourceStats['triangles'] and summaries[name]['vertices']==sourceStats['vertices']
 templates['ie-'+name]={'frame':{'center':[0,round(height/2,4),0],'half':round(height/2,4)},'colliders':[[0,0,round(trunk,4)]],'crown':{'y':round((crownLow+height)/2,3),'r':round(crownR*.85,4)}}

summary={'blender':bpy.app.version_string,'method':'thinner trunk and root flare, shorter clear bole, narrower tapered crown with uneven bough lengths, slight leader lean, leaf pads moved rigidly and shrunk about their centres, bark normals via Jacobian','paidCalls':0,'decimated':False,'forms':summaries}
tag='-'.join(only) if only else 'all'
(EVIDENCE/f'asset-validation-{tag}.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
(EVIDENCE/f'template-{tag}.json').write_text(json.dumps(templates,indent=2),encoding='utf-8')
print('SUMMARY',json.dumps({k:{x:v[x] for x in ('height','trunkRadius','uniformTrunkRadius','crownBase','crownRadius','leafPads','sheetPadsLeftToBend','leafVertices','bytes')} for k,v in summaries.items()}))
