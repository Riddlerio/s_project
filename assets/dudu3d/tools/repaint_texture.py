"""두두 GLB의 기본색 텍스처를 원화(조형 도면)에 맞게 고친다. 형태·뼈대·동작은 건드리지 않는다.

- 망토: 바깥면 청록, 안쪽면 연두(원화). 텍스처의 명암(주름)은 밝기 비율로 유지한다.
- 뒷머리: 세로 줄 하나 대신 원화 후면처럼 가운데가 빈 좌우 짝 가로줄 네 쌍, 귀 뒷면은 어둡게.
- 스카프: 짙은 초록 대신 원화처럼 망토 겉과 같은 청록. 매듭·주름 명암은 남긴다(2026-10-04 추가).

실행: blender -b --factory-startup --python repaint_texture.py -- <입력.glb> <출력 폴더> [debug]
출력: basecolor.png(고친 텍스처), mask.png(영역 확인용), stats.txt
"""
import math
import os
import sys

import bpy
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
src, out_dir = os.path.abspath(args[0]), os.path.abspath(args[1])
os.makedirs(out_dir, exist_ok=True)

# 원화에서 잰 색(sRGB 0~255)
CAPE_OUTER = np.array([50, 117, 100]) / 255
CAPE_INNER = np.array([121, 181, 72]) / 255
STRIPE = np.array([50, 45, 40]) / 255
EAR_BACK = np.array([54, 54, 54]) / 255

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obj = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
me = obj.data
base = next(i for i in bpy.data.images if not any(k in i.name.lower() for k in ("normal", "metal", "rough")))
W, H = base.size
tex = np.array(base.pixels[:], dtype=np.float32).reshape(H, W, 4)
rgb = tex[:, :, :3].copy()

# ---- 텍셀 → 3D 위치·법선·머리 가중치 (UV 삼각형 래스터화) ----
co = np.array([v.co[:] for v in me.vertices], dtype=np.float64)
vn = np.array([v.normal[:] for v in me.vertices], dtype=np.float64)
head_group = obj.vertex_groups["mixamorig:Head"].index
hw = np.zeros(len(me.vertices))
for v in me.vertices:
    for g in v.groups:
        if g.group == head_group:
            hw[v.index] = g.weight
uvl = me.uv_layers.active.data
me.calc_loop_triangles()
pos = np.zeros((H, W, 3), np.float32)
nrm = np.zeros((H, W, 3), np.float32)
head = np.zeros((H, W), np.float32)
covered = np.zeros((H, W), bool)
for tri in me.loop_triangles:
    uv = np.array([uvl[l].uv[:] for l in tri.loops]) * [W, H] - 0.5
    x0, y0 = np.floor(uv.min(0)).astype(int)
    x1, y1 = np.ceil(uv.max(0)).astype(int)
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
    if x1 < x0 or y1 < y0:
        continue
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    p = np.stack([gx.ravel(), gy.ravel()], 1).astype(np.float64)
    a, b, c = uv
    m = np.array([[b[0] - a[0], c[0] - a[0]], [b[1] - a[1], c[1] - a[1]]])
    det = np.linalg.det(m)
    if abs(det) < 1e-12:
        continue
    l12 = np.linalg.solve(m, (p - a).T).T
    l0 = 1 - l12.sum(1)
    bary = np.column_stack([l0, l12])
    inside = (bary >= -1e-3).all(1)
    if not inside.any():
        continue
    bary, px = bary[inside], p[inside].astype(int)
    vs = list(tri.vertices)
    pos[px[:, 1], px[:, 0]] = bary @ co[vs]
    nrm[px[:, 1], px[:, 0]] = bary @ vn[vs]
    head[px[:, 1], px[:, 0]] = bary @ hw[vs]
    covered[px[:, 1], px[:, 0]] = True
nrm /= np.linalg.norm(nrm, axis=2, keepdims=True) + 1e-9

# ---- 영역 분류 ----
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
greenish = covered & (g > r * 1.12) & (g > b * 1.02) & (rgb.max(2) - rgb.min(2) > 0.12)
body = covered & (head < 0.5)
# 몸통 축: 망토가 아닌 몸통 텍셀의 수평 중심
torso = body & ~greenish & (pos[..., 2] > 0.25) & (pos[..., 2] < 0.6)
axis = pos[torso][:, :2].mean(0)
# 가슴 앞 흉장(초록 심벌)은 망토가 아니다. 망토는 몸 뒤와 양옆에만 있다.
emblem_zone = (pos[..., 1] < axis[1] - 0.05) & (np.abs(pos[..., 0] - axis[0]) < 0.25)
# 목 뒤(머리 가중치가 섞인 곳)의 초록도 망토·스카프로 본다.
cape = greenish & (pos[..., 2] < 0.75) & ~emblem_zone
radial = pos[..., :2] - axis
radial /= np.linalg.norm(radial, axis=2, keepdims=True) + 1e-9
facing = (nrm[..., :2] * radial).sum(2)
cape_outer = cape & (facing > 0)
cape_inner = cape & (facing <= 0)

# 스카프: 원화에서 스카프는 망토 겉과 같은 청록이다. Meshy 텍스처의 스카프는 채도가 낮은 짙은 초록이라
# 망토보다 느슨한 기준으로 찾는다. 흉장의 초록(높이 0.52 이하)과는 높이로, 망토와는 목에서의 거리로 나눈다.
# 자동 리그가 스카프 앞쪽에 머리 뼈 가중치(0.66~0.81)를 주어서 머리 가중치로는 거르지 않는다(얼굴에는 초록이 없다).
SCARF_Z = 0.54
dark_green = covered & (g > r * 1.15) & (g >= b * 0.95) & (rgb.max(2) - rgb.min(2) > 0.035)
scarf_front = dark_green & emblem_zone & (pos[..., 2] >= SCARF_Z)
neck_r = np.linalg.norm(pos[..., :2] - axis, axis=2)
scarf_r = np.percentile(neck_r[scarf_front], 95) + 0.015 if scarf_front.any() else 0.0
# 이미 망토로 칠한 목 뒤·옆은 망토 명암을 그대로 두고, 남은 짙은 초록(앞 매듭·주름)만 칠한다.
scarf = dark_green & (pos[..., 2] >= SCARF_Z) & (neck_r <= scarf_r) & ~cape

# 머리 좌표: 머리 텍셀(귀 제외 전)의 중심과 반지름
headm = covered & (head > 0.5)
hp = pos[headm]
center = np.array([(hp[:, 0].max() + hp[:, 0].min()) / 2, np.median(hp[:, 1]), np.percentile(hp[:, 2], 45)])
d = pos - center
rx = np.percentile(np.abs(hp[:, 0] - center[0]), 97)
rz = np.percentile(np.abs(hp[:, 2] - center[2]), 90)
X, Y = d[..., 0] / rx, d[..., 2] / rz
back = headm & (d[..., 1] > 0)  # 뒤쪽(+Y)
backness = np.clip(d[..., 1] / (np.linalg.norm(d, axis=2) + 1e-9), 0, 1)  # 정뒤 1, 옆 0
# 귀: 머리 타원 바깥(위)으로 튀어나온 부분
ear = headm & (Y > 0.78) & (np.abs(X) > 0.42)
ear_back = ear & (nrm[..., 1] > 0.15)

# 뒷머리 줄무늬(원화 후면): 가운데 틈, 안쪽 끝이 뾰족, 맨 위 줄은 바깥이 처진다.
stripes = [(0.46, -0.12), (0.06, 0.0), (-0.32, 0.02), (-0.68, 0.10)]  # (가운데 높이, 바깥 처짐/올라감)
HALF, GAP, TAPER = 0.085, 0.07, 0.22
ax = np.abs(X)
stripe_mask = np.zeros((H, W), bool)
for y0, bend in stripes:
    centre = y0 + bend * ax ** 2
    taper = np.clip((ax - GAP) / TAPER, 0, 1) ** 0.6
    stripe_mask |= (ax > GAP) & (np.abs(Y - centre) < HALF * taper)
# 뒷머리 덮어쓰기 영역: 정뒤에서 옆으로 갈수록 기존 텍스처와 섞는다.
blend = np.clip((backness - 0.25) / 0.35, 0, 1) * back * ~ear * ~greenish * (Y > -0.9)
fur = np.median(rgb[headm & (lum > 0.8)], axis=0)

# ---- 칠하기 ----
out = rgb.copy()
ref = np.median(lum[cape]) if cape.any() else 1
shade = np.clip(lum / ref, 0.55, 1.25)[..., None]
out[cape_outer] = (CAPE_OUTER * shade[cape_outer]).clip(0, 1)
out[cape_inner] = (CAPE_INNER * shade[cape_inner]).clip(0, 1)
# 스카프는 자기 밝기 기준으로 명암(매듭·주름·외곽선)을 남긴다.
scarf_ref = np.median(lum[scarf]) if scarf.any() else 1
scarf_shade = np.clip(lum / scarf_ref, 0.55, 1.3)[..., None]
out[scarf] = (CAPE_OUTER * scarf_shade[scarf]).clip(0, 1)
paint = np.where(stripe_mask[..., None], STRIPE, fur)
out = out * (1 - blend[..., None]) + paint * blend[..., None]
out[ear_back] = EAR_BACK

# UV 섬 가장자리 번짐을 막으려고 바뀐 텍셀을 3px 바깥으로 넓힌다.
changed = covered & (np.abs(out - rgb).sum(2) > 0.02)
grow_val, grow_mask = out.copy(), changed.copy()
for _ in range(3):
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        src_m = np.roll(grow_mask, (dy, dx), (0, 1))
        src_v = np.roll(grow_val, (dy, dx), (0, 1))
        take = src_m & ~grow_mask & ~covered
        grow_val[take], grow_mask[take] = src_v[take], True
out = np.where((grow_mask & ~covered)[..., None], grow_val, out)

# ---- 저장 ----
def save(name, arr):
    # 8비트 이미지로 만들어 값 그대로(색 관리 없이) PNG로 쓴다.
    img = bpy.data.images.new(name, W, H, alpha=True, float_buffer=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels[:] = np.concatenate([arr, np.ones((H, W, 1), np.float32)], 2).ravel()
    path = os.path.join(out_dir, name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    if not os.path.exists(path):
        raise SystemExit("save failed: " + path)

mask = rgb * 0.35
mask[cape_outer] = [1, 0.2, 0.2]
mask[cape_inner] = [0.2, 0.4, 1]
mask[blend > 0.01] = mask[blend > 0.01] * 0.3 + np.array([1, 0.9, 0.2]) * 0.7 * blend[blend > 0.01][:, None]
mask[stripe_mask & back] = [0, 0, 0]
mask[ear_back] = [1, 0.2, 1]
mask[scarf] = [0.2, 1, 1]
save("mask", mask.astype(np.float32))
if "debug" not in args:
    save("basecolor", out.astype(np.float32))
with open(os.path.join(out_dir, "stats.txt"), "w", encoding="utf-8") as f:
    f.write(f"texture {W}x{H}\naxis {axis}\nhead center {center} rx {rx:.3f} rz {rz:.3f}\n")
    f.write(f"cape outer {int(cape_outer.sum())} inner {int(cape_inner.sum())} ear_back {int(ear_back.sum())}\n")
    f.write(f"back blend texels {int((blend > 0.01).sum())} stripe texels {int((stripe_mask & (blend > 0.5)).sum())}\n")
    f.write(f"fur {fur} cape ref lum {ref:.3f}\n")
    f.write(f"scarf {int(scarf.sum())} (front {int(scarf_front.sum())}) neck radius {scarf_r:.3f} ref lum {scarf_ref:.3f}\n")
print(open(os.path.join(out_dir, "stats.txt"), encoding="utf-8").read())
