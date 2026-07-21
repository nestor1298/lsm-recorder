"""Morphs faciales 100% procedurales sobre la geometría nativa de Lexsi."""
import bpy, mathutils, collections
# Entrada: lexsi SIN morphs (git show 7376e8a:public/models/lexsi.glb).
# Salida densa; comprimir después: npx @gltf-transform/cli sparse out.glb public/models/lexsi.glb
LEXSI="/tmp/lexsi_clean.glb"; OUT="/tmp/lexsi_dense.glb"
def log(m): print(f"[b] {m}", flush=True)
def smooth(t):
    t=max(0.0,min(1.0,t)); return t*t*(3-2*t)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=LEXSI)
body = max((o for o in bpy.data.objects if o.type=="MESH"), key=lambda o: len(o.data.vertices))
M=body.matrix_world; R=M.inverted().to_3x3()
me=body.data
slots=collections.defaultdict(set)
for poly in me.polygons: slots[poly.material_index].update(poly.vertices)
mats=[m.name if m else "?" for m in me.materials]
eyes=slots[next(i for i,nm in enumerate(mats) if "Eye" in nm)]
skin=slots[1]
body.shape_key_add(name="Basis",from_mix=False)
kb=me.shape_keys.key_blocks
basis=kb[0].data
W=[M@basis[i].co for i in range(len(basis))]

XC=0.0047; ZM=0.5125            # centro x, línea de labios (la nariz vive arriba: z>0.520)
LIP_Z=(0.5050,0.5185); LIP_X=0.021; FRONT=-0.041
CHIN_Z=(0.4985,0.5050)

def lip_w(i):
    x,y,z=W[i].x,W[i].y,W[i].z
    if y>FRONT or abs(x-XC)>LIP_X or not (LIP_Z[0]<=z<=LIP_Z[1]): return 0.0
    zw=smooth(1-abs(z-ZM)/((LIP_Z[1]-LIP_Z[0])/2))
    xw=smooth(1-abs(x-XC)/LIP_X)
    return zw*max(xw,0.25)  # las comisuras conservan peso
def chin_w(i):
    x,y,z=W[i].x,W[i].y,W[i].z
    if y>-0.036 or abs(x-XC)>0.03 or not (CHIN_Z[0]<=z<=CHIN_Z[1]): return 0.0
    return smooth((z-CHIN_Z[0])/(CHIN_Z[1]-CHIN_Z[0]))
def cheek_w(i,side):
    x,y,z=W[i].x,W[i].y,W[i].z
    dx=(x-XC)*side
    if y>-0.028 or not (0.010<dx<0.038) or not (0.512<z<0.540): return 0.0
    return smooth(1-abs(dx-0.022)/0.014)*smooth(1-abs(z-0.526)/0.014)
def corner_w(i,side):
    lw=lip_w(i)
    if not lw: return 0.0
    dx=(W[i].x-XC)*side
    return lw*smooth(dx/LIP_X) if dx>0 else 0.0
def upper(i): return W[i].z>=ZM
V=mathutils.Vector
def K(name): return body.shape_key_add(name=name,from_mix=False)
def add(k,i,d):
    if d.length_squared>1e-16: k.data[i].co=k.data[i].co+R@d

lips=[i for i in skin if lip_w(i)>0]; chin=[i for i in skin if chin_w(i)>0]
log(f"labios: {len(lips)}, mentón: {len(chin)}")

# ── boca ──
kjaw=K("jawOpen")
for i in skin:
    x,y,z=W[i].x,W[i].y,W[i].z
    if y>-0.026 or abs(x-XC)>0.034 or not (0.4975<=z<=ZM+0.003): return_=None
    else:
        zw=smooth((ZM+0.003-z)/0.006) if z>ZM-0.004 else 1.0     # rampa bajo la línea
        xw=smooth(1-abs(x-XC)/0.034)
        yw=smooth((-0.026-y)/0.010)
        w=min(zw,1.0)*xw*yw
        if w>0: add(kjaw,i,V((0,0.0015,-0.0105))*w)
kpk=K("lipPucker")
for i in lips:
    lw=lip_w(i)
    add(kpk,i,V((-(W[i].x-XC)*0.55,-0.006,-(W[i].z-ZM)*0.30))*lw)
kfl=K("lipFunnelerLower"); kfu=K("lipFunnelerUpper")
for i in lips:
    lw=lip_w(i)
    if upper(i): add(kfu,i,V((0,-0.004,0.0015))*lw)
    else:
        add(kfl,i,V((0,-0.004,-0.0015))*lw)
kcl=K("lipCloseLower"); kcu=K("lipCloseUpper")
for i in lips:
    lw=lip_w(i)
    if upper(i): add(kcu,i,V((0,0.001,-0.0012))*lw)
    else: add(kcl,i,V((0,0.001,0.0012))*lw)
kplL=K("lipPresserL"); kplR=K("lipPresserR")
for i in lips:
    for k,s in ((kplL,1),(kplR,-1)):
        cw=corner_w(i,s)
        if cw: add(k,i,V((0,0.002,0))*cw)
kwL=K("lipWidenL"); kwR=K("lipWidenR")
ksoL=K("lipSmileOpenL"); ksoR=K("lipSmileOpenR")
kcuL=K("lipCornerUpL"); kcuR=K("lipCornerUpR")
for i in lips:
    for s,kw_,kso,kcu_ in ((1,kwL,ksoL,kcuL),(-1,kwR,ksoR,kcuR)):
        cw=corner_w(i,s)
        if cw:
            add(kw_,i,V((0.009*s,0,0))*cw)
            add(kso,i,V((0.007*s,0,0.002))*cw)
            add(kcu_,i,V((0.002*s,0,0.0045))*cw)
kchL=K("cheekUpL"); kchR=K("cheekUpR")
for i in skin:
    for s,k in ((1,kchL),(-1,kchR)):
        cwk=cheek_w(i,s)
        if cwk: add(k,i,V((0,-0.002,0.004))*cwk)

# ── cejas / ojos (igual que la versión validada, squeeze sin pico) ──
ex=[W[i].x for i in eyes]; ez=[W[i].z for i in eyes]
exc=(min(ex)+max(ex))/2; eye_top=max(ez)
eyeL=[i for i in eyes if W[i].x>=exc]; eyeR=[i for i in eyes if W[i].x<exc]
def zc_of(vs): zz=[W[i].z for i in vs]; return (min(zz)+max(zz))/2
zcL,zcR=zc_of(eyeL),zc_of(eyeR)
b_lo=eye_top+0.002; b_hi=eye_top+0.028
brow=[i for i in skin if b_lo<=W[i].z<=b_hi and W[i].y<-0.015 and abs(W[i].x-exc)<0.05]
def band_w(i): return smooth(1-abs((W[i].z-(b_lo+b_hi)/2)/((b_hi-b_lo)/2)))
def inner_w(i): return smooth(1-abs(W[i].x-exc)/0.05)
def outer_w(i): return smooth(abs(W[i].x-exc)/0.05)
def side_w(i,s): return 1.0 if (W[i].x-exc)*s>=0 else 0.0
for s,sn in ((1,"L"),(-1,"R")):
    kiu=K(f"browInnerUp{sn}"); kou=K(f"browOuterUp{sn}")
    kid=K(f"browInnerDn{sn}"); ksq=K(f"browSqueeze{sn}")
    for i in brow:
        sw=side_w(i,s)
        if not sw: continue
        bw=band_w(i)*sw
        add(kiu,i,V((0,0,0.009))*bw*inner_w(i))
        add(kou,i,V((0,0,0.009))*bw*outer_w(i))
        add(kid,i,V((0,-0.002,-0.006))*bw*inner_w(i))
        add(ksq,i,V((-(W[i].x-exc)*0.35,-0.001,-0.002))*bw)
    kwid=K(f"eyeWidenUpper{sn}"); ksq2=K(f"eyeSquint{sn}")
    vs,zc=(eyeL,zcL) if sn=="L" else (eyeR,zcR)
    for i in vs:
        dz=W[i].z-zc
        add(kwid,i,V((0,0,dz*0.65)))
        add(ksq2,i,V((0,0,-dz*0.70)))
    for i in brow:
        sw=side_w(i,s)
        if sw: add(kwid,i,V((0,0,0.004))*band_w(i)*sw)
log(f"keys: {len(kb)-1}")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT,export_format="GLB",export_morph=True,
    export_morph_normal=False,export_animations=False,export_yup=True)
log("LISTO")
