import bpy, sys, mathutils
from mathutils.bvhtree import BVHTree

LEXSI="/Users/nestoraldreteochoa/Downloads/lsm-recorder/public/models/lexsi.glb"
SRC="/Users/nestoraldreteochoa/Downloads/lsm-recorder/public/models/character.glb"
OUT="/Users/nestoraldreteochoa/Downloads/lsm-recorder/public/models/lexsi_face.glb"
NEEDED=["browInnerUpL","browInnerUpR","browOuterUpL","browOuterUpR","browInnerDnL","browInnerDnR",
"browSqueezeL","browSqueezeR","eyeWidenUpperL","eyeWidenUpperR","eyeSquintL","eyeSquintR","jawOpen",
"lipFunnelerLower","lipFunnelerUpper","lipCloseLower","lipCloseUpper","lipPresserL","lipPresserR",
"lipPucker","lipWidenL","lipWidenR","lipSmileOpenL","lipSmileOpenR","lipCornerUpL","lipCornerUpR",
"cheekUpL","cheekUpR"]
def log(m): print(f"[t3] {m}", flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=LEXSI)
lexsi_objs=list(bpy.data.objects)
body=max((o for o in lexsi_objs if o.type=="MESH"),key=lambda o:len(o.data.vertices))
arm=next((o for o in lexsi_objs if o.type=="ARMATURE"),None)
Ml=body.matrix_world
lex_world=[Ml@v.co for v in body.data.vertices]
# cabeza de Lexsi: por hueso Head si existe
head_z=None
if arm:
    b=arm.data.bones.get("Head") or next((bb for bb in arm.data.bones if "head" in bb.name.lower()),None)
    if b: head_z=(arm.matrix_world@b.head_local).z
zs=[p.z for p in lex_world]; z0,z1=min(zs),max(zs)
if head_z is None: head_z=z0+0.84*(z1-z0)
head_verts=[p for p in lex_world if p.z>=head_z]
hx=[p.x for p in head_verts]; hy=[p.y for p in head_verts]; hz=[p.z for p in head_verts]
lex_head_c=mathutils.Vector(((min(hx)+max(hx))/2,(min(hy)+max(hy))/2,(min(hz)+max(hz))/2))
lex_head_h=max(hz)-min(hz)
log(f"lexsi: cabeza z>={head_z:.3f}, centro={tuple(round(c,3) for c in lex_head_c)}, alto={lex_head_h:.3f}")

before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
src_objs=[o for o in bpy.data.objects if o not in before]
srcm=next(o for o in src_objs if o.type=="MESH" and o.data.shape_keys and len(o.data.shape_keys.key_blocks)>10)
kb=srcm.data.shape_keys.key_blocks
basis=kb[0].data; n=len(basis)
# vértices que se mueven en cualquiera de las keys necesarias
moving=set()
for name in NEEDED:
    d=kb[name].data
    for i in range(n):
        if (d[i].co-basis[i].co).length_squared>1e-6: moving.add(i)
log(f"fuente: {srcm.name}, vértices móviles={len(moving)}/{n}")
Ms0=srcm.matrix_world
mv=[Ms0@basis[i].co for i in moving]
mx=[p.x for p in mv]; my=[p.y for p in mv]; mz=[p.z for p in mv]
src_face_c=mathutils.Vector(((min(mx)+max(mx))/2,(min(my)+max(my))/2,(min(mz)+max(mz))/2))
src_face_h=max(mz)-min(mz)
log(f"cara fuente: centro={tuple(round(c,2) for c in src_face_c)}, alto={src_face_h:.2f}, bbox x=({min(mx):.1f},{max(mx):.1f}) y=({min(my):.1f},{max(my):.1f}) z=({min(mz):.1f},{max(mz):.1f})")
# la cara ocupa ~2/3 de la cabeza: escalar cara fuente a 0.66*alto de cabeza lexsi
scale=(lex_head_h*0.75)/src_face_h
T=mathutils.Matrix.Translation(lex_head_c - src_face_c*scale)@mathutils.Matrix.Scale(scale,4)
Ms=T@Ms0
src_world=[Ms@basis[i].co for i in range(n)]
log(f"escala={scale:.5f}")
srcm.data.calc_loop_triangles()
tris=[(t.vertices[0],t.vertices[1],t.vertices[2]) for t in srcm.data.loop_triangles]
bvh=BVHTree.FromPolygons([v[:] for v in src_world],tris,all_triangles=True)
MAXD=0.03
def wgt(d):
    if d>=MAXD: return 0.0
    t=1-d/MAXD; return t*t*(3-2*t)
Mli=Ml.inverted(); R=Mli.to_3x3()
mapping=[]
for v in body.data.vertices:
    wco=Ml@v.co
    loc,nrm,ti,dist=bvh.find_nearest(wco)
    if loc is None or dist>MAXD: continue
    i0,i1,i2=tris[ti]
    p0,p1,p2=src_world[i0],src_world[i1],src_world[i2]
    at=mathutils.geometry.area_tri(p0,p1,p2)
    if at<1e-14: continue
    w0=mathutils.geometry.area_tri(loc,p1,p2)/at
    w1=mathutils.geometry.area_tri(p0,loc,p2)/at
    w2=mathutils.geometry.area_tri(p0,p1,loc)/at
    s=w0+w1+w2
    mapping.append((v.index,(i0,i1,i2),(w0/s,w1/s,w2/s),wgt(dist)))
log(f"mapeados: {len(mapping)}")
if len(mapping)<100: log("ERROR mapeo"); sys.exit(1)
if not body.data.shape_keys: body.shape_key_add(name="Basis",from_mix=False)
created=0
for name in NEEDED:
    if name not in kb: continue
    kd=kb[name].data
    disp=[(Ms@kd[i].co)-src_world[i] for i in range(n)]
    nk=body.shape_key_add(name=name,from_mix=False)
    moved=0
    for vi,(i0,i1,i2),(w0,w1,w2),dw in mapping:
        d=(disp[i0]*w0+disp[i1]*w1+disp[i2]*w2)*dw
        if d.length_squared>1e-12:
            nk.data[vi].co=nk.data[vi].co+R@d; moved+=1
    created+=1
    if name in ("browInnerUpL","jawOpen","lipPucker"): log(f"  {name}: {moved} verts")
log(f"keys creadas: {created}")
bpy.ops.object.select_all(action="DESELECT")
for o in src_objs: o.select_set(True)
bpy.ops.object.delete()
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT,export_format="GLB",export_morph=True,export_morph_normal=False,export_animations=False,export_yup=True)
log("LISTO")
