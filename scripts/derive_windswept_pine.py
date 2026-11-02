"""Derive the IE-09 windswept pines from the AHOLO old pine in an isolated Blender process.

Root flare stays planted; the trunk bends continuously to leeward, crown tiers are flattened,
the windward side is sheared short and wind-clipped, with its needle pads shrunk back to bare
twig ends, and the leeward side reaches out. Needle texels are cooled toward the IE-09 blue-green.
Two forms share one recoloured texture: A (mature) and B (thinner, harder sheared, mirrored pads).
Every face, UV and the material are kept; custom normals follow the deformation by its Jacobian.
"""
import bpy, json, math, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/assets/island-trees/old-pine.glb'
WORK=ROOT/'assets/blender/windswept-pine'
EVIDENCE=ROOT/'docs/evidence/2026-11-02-windswept-pine'
for p in [WORK,EVIDENCE]:p.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(meshes)==1
tree=meshes[0];m=tree.data
transform=tree.matrix_world.copy();tree.parent=None;tree.matrix_world.identity();m.transform(transform)

def smooth(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
ROOTS=1.6  # source height where the root flare and lower trunk end
FORMS={
 # thin: trunk/root girth; crown: squash above the roots; lean: trunk tip angle (rad, (s/H)^1.5 ramp);
 # windward/leeward: bough length factors; dead: how far windward pads shrink to bare twigs; clip: wind-cut slope.
 'windswept-pine':{'thin':.7,'crown':.8,'lean':.92,'windward':.45,'leeward':1.15,'dead':.62,'clip':.55,'mirror':False},
 'windswept-pine-b':{'thin':.56,'crown':.72,'lean':1.12,'windward':.36,'leeward':1.2,'dead':.75,'clip':.8,'mirror':True},
}

# Needle texels: the runtime foliage shader uses the same green-over-red test. Cool the olive toward IE-09 blue-green.
image=[n.image for n in m.materials[0].node_tree.nodes if n.type=='TEX_IMAGE'][0]
w,h=image.size;px=np.empty(w*h*4,np.float32);image.pixels.foreach_get(px);px=px.reshape(h,w,4)
leafTexel=np.clip((px[...,1]-px[...,0]+.02)/.06,0,1)[...,None]
before=px[...,:3][leafTexel[...,0]>.5].mean(0)
px[...,:3]*=1+(np.array([.7,.9,1.04],np.float32)-1)*leafTexel
after=px[...,:3][leafTexel[...,0]>.5].mean(0)
image.pixels.foreach_set(px.ravel());image.file_format='WEBP';image.update();image.pack()  # source ships WebP

# Needle pads = connected runs of leaf vertices (by the texel under their corners).
uv=np.empty(len(m.loops)*2,np.float32);m.uv_layers.active.data.foreach_get('uv',uv);uv=uv.reshape(-1,2)
vi=np.empty(len(m.loops),np.int32);m.loops.foreach_get('vertex_index',vi)
cornerLeaf=leafTexel[np.clip((uv[:,1]*h).astype(int),0,h-1),np.clip((uv[:,0]*w).astype(int),0,w-1),0]>.5
leafVotes=np.bincount(vi,weights=cornerLeaf,minlength=len(m.vertices));cornerCount=np.bincount(vi,minlength=len(m.vertices))
leaf=leafVotes>cornerCount*.5
parent=list(range(len(m.vertices)))
def find(a):
 while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
 return a
for e in m.edges:
 a,b=e.vertices
 if leaf[a] and leaf[b]:parent[find(a)]=find(b)
original=[v.co.copy() for v in m.vertices]
pads={}
for i,v in enumerate(original):
 if leaf[i]:pads.setdefault(find(i),[]).append(i)
padCentre={k:sum((original[i] for i in idx),Vector())/len(idx) for k,idx in pads.items()}
padOf={i:k for k,idx in pads.items() for i in idx}
normals=[Vector(c.vector) for c in m.corner_normals]
source={'triangles':sum(len(p.vertices)-2 for p in m.polygons),'vertices':len(m.vertices)}

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
camera.data.type='ORTHO';scene.collection.objects.link(camera);scene.camera=camera
def render(name,angle,centre,scale):
 camera.data.ortho_scale=scale;centre=Vector(centre);camera.location=centre+Vector((math.sin(angle),-math.cos(angle),.1))*16
 camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(EVIDENCE/name);bpy.ops.render.render(write_still=True)

def derive(F):
 height=ROOTS*.92+(8-ROOTS)*F['crown'];steps=400
 curve=[(0.0,0.0)]  # leeward offset and height of the trunk axis per arc-length step
 for i in range(steps):
  s=(i+.5)/steps*height;a=F['lean']*(s/height)**1.5
  x,z=curve[-1];curve.append((x+math.sin(a)*height/steps,z+math.cos(a)*height/steps))
 def axis(s):
  u=max(0,min(steps,s/height*steps));i=min(steps-1,int(u));f=u-i
  return curve[i][0]+(curve[i+1][0]-curve[i][0])*f,curve[i][1]+(curve[i+1][1]-curve[i][1])*f,F['lean']*(max(0,s)/height)**1.5
 def shape(p):
  """Source point (Blender Z-up) -> windswept point; leeward is +X before the final turn."""
  x,y,z=p.x,(-p.y if F['mirror'] else p.y),p.z
  s=z*.92 if z<ROOTS else ROOTS*.92+(z-ROOTS)*F['crown']
  s-=.12*smooth(6.8,8,z)*(z-6.8)  # slightly flatter top dome
  r=math.hypot(x,y);w=smooth(.55,1.3,r)*smooth(1.2,2.2,z)  # pads and boughs, not trunk or roots
  k=F['thin']+(1-F['thin'])*smooth(1.0,1.9,r)*smooth(1.2,2.2,z);x*=k;y*=k  # whole trunk girth, boughs keep their length
  # Windward boughs cut short, leeward ones reach out and droop a little under their own length.
  f=F['windward']+(F['leeward']-F['windward'])*smooth(-1.2,1.0,x)
  d=x*(1+(f-1)*w)
  lateral=y*(1-.14*w)
  s-=w*.1*max(0,d)**1.25
  # Wind-cut face: windward crown is pressed under a plane falling away from the axis top.
  cap=height*.86+F['clip']*min(d,0)
  s-=w*.8*max(0,s-cap)
  ax,az,a=axis(s)
  # Near the axis offsets turn with the bending trunk; outer pads only follow it and stay level.
  turn=a*(1-w)*(1-smooth(5.4,6.9,z));c=math.cos(turn);sn=math.sin(turn)
  return Vector((ax+d*c,lateral,az-d*sn))
 def final(v):return Vector((v.y,-v.x,v.z))  # leeward +X ends on -Y (glTF +Z); the runtime yaw sets the wind
 def windwardOf(c):return -c.x  # pads are judged before mirroring; mirroring only swaps the lateral side
 jac=[];eps=1e-3;bare=0
 for i,(v,p) in enumerate(zip(m.vertices,original)):
  if i in padOf:
   c=padCentre[padOf[i]];shrink=1-F['dead']*smooth(.4,2.4,windwardOf(c))
   if shrink<.6:bare+=1
   p=c+(p-c)*shrink  # uniform per pad, so normals keep their direction
  q=final(shape(p))
  cols=[(final(shape(p+Vector(e)*eps))-q)/eps for e in ((1,0,0),(0,1,0),(0,0,1))]
  jac.append(Matrix((cols[0],cols[1],cols[2])).transposed().inverted_safe().transposed());v.co=q
 corner={(poly.index,m.loops[li].vertex_index):(jac[m.loops[li].vertex_index]@normals[li]).normalized() for poly in m.polygons for li in poly.loop_indices}
 if F['mirror']:m.flip_normals()  # a mirror reverses winding; corners are re-matched by face and vertex below
 m.normals_split_custom_set([corner[(poly.index,m.loops[li].vertex_index)] for poly in m.polygons for li in poly.loop_indices])
 m.validate();m.update();bpy.context.view_layer.update()
 return bare

summaries={};templates={}
render('source-side.png',math.pi/2,(0,0,4),9)
for name,F in FORMS.items():
 bare=derive(F);tree.name=name.replace('-','_').title()
 vertices=[v.co for v in m.vertices];top=max(v.z for v in vertices)
 # Lean axis is -Y: the side views show the windswept silhouette, the front view its narrow profile.
 for view,angle in [('side',math.pi/2),('back',-math.pi/2),('front',0),('quarter',math.pi/2+.7)]:
  render(f'{name.replace("windswept-pine","windswept")}-{view}.png',angle,(0,-1.2,top/2),7.4)
 bpy.ops.object.select_all(action='DESELECT');tree.select_set(True);bpy.context.view_layer.objects.active=tree
 out=WORK/f'{name}.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_image_format='WEBP',export_image_quality=90)
 bpy.ops.wm.save_as_mainfile(filepath=str(WORK/f'{name}.blend'))
 trunk=max(math.hypot(v.x,v.y) for v in vertices if .25<v.z<1.0)
 lee=-min(v.y for v in vertices if v.z>1.4);windward=max(v.y for v in vertices if v.z>1.4)
 summaries[name]={'form':F,'height':top,'baseRadius':max(math.hypot(v.x,v.y) for v in vertices if v.z<.25),'trunkRadius':trunk,'leewardReach':lee,'windwardReach':windward,
  'needlePads':len(pads),'bareTwigVertices':bare,
  'triangles':sum(len(p.vertices)-2 for p in m.polygons),'vertices':len(vertices),'materials':len(m.materials),'uvLayers':len(m.uv_layers),
  'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'candidate':str(out.relative_to(ROOT))}
 assert summaries[name]['triangles']==source['triangles'] and summaries[name]['vertices']==source['vertices']
 # Crown sphere is camera-only and sits on the trunk: mean half-width, not the leeward reach.
 templates['ie-'+name]={'frame':{'center':[0,top/2,0],'half':top/2},'colliders':[[0,0,round(trunk,4)]],'crown':{'y':round(top*.72,3),'r':round((lee+windward)/2,4)}}
summary={'sourceTaskId':4461967,'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'blender':bpy.app.version_string,
 'method':'planted root flare, girth thinning, continuous leeward trunk bend, crown squash, windward boughs shortened and wind-cut, windward needle pads shrunk to bare twigs, leeward reach with droop, custom normals via Jacobian',
 'needleTexelMeanSrgb':{'before':before.round(4).tolist(),'after':after.round(4).tolist()},'sourceTriangles':source['triangles'],'sourceVertices':source['vertices'],'paidCalls':0,'decimated':False,'forms':summaries}
(EVIDENCE/'asset-validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
(EVIDENCE/'template.json').write_text(json.dumps(templates,indent=2),encoding='utf-8')
print('SUMMARY',json.dumps({k:{x:v[x] for x in ('height','trunkRadius','leewardReach','windwardReach','needlePads','bareTwigVertices','bytes')} for k,v in summaries.items()}),json.dumps(summary['needleTexelMeanSrgb']))
