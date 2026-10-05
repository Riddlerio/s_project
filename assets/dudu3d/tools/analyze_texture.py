"""두두 GLB를 Blender에서 열어 텍스처·메시 구조를 요약한다(읽기 전용).

실행: blender -b --factory-startup --python analyze_texture.py -- <입력.glb>
"""
import sys

import bpy
import numpy as np

src = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

mesh_obj = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
me = mesh_obj.data
print("objects", [(o.name, o.type) for o in bpy.data.objects])
print("images", [(i.name, tuple(i.size)) for i in bpy.data.images])
print("vertex groups", [g.name for g in mesh_obj.vertex_groups][:40])

base = next(i for i in bpy.data.images if "normal" not in i.name.lower() and "metal" not in i.name.lower() and "rough" not in i.name.lower())
w, h = base.size
px = np.array(base.pixels[:], dtype=np.float32).reshape(h, w, 4)

co = np.array([v.co[:] for v in me.vertices])
print("bbox min", co.min(0).round(3), "max", co.max(0).round(3))
uv = me.uv_layers.active.data
me.calc_loop_triangles()
cents, cols, norms = [], [], []
for tri in me.loop_triangles:
    u = np.mean([uv[l].uv[:] for l in tri.loops], axis=0)
    x, y = int(np.clip(u[0], 0, 0.9999) * w), int(np.clip(u[1], 0, 0.9999) * h)
    cols.append(px[y, x, :3])
    cents.append(np.mean([co[v] for v in tri.vertices], axis=0))
    norms.append(tri.normal[:])
cents, cols, norms = np.array(cents), np.array(cols), np.array(norms)
r, g, b = cols[:, 0], cols[:, 1], cols[:, 2]
green = (g > r * 1.15) & (g > b * 1.05)
dark = cols.max(1) < 0.25
print("tris", len(cents), "green", int(green.sum()), "dark", int(dark.sum()))
print("green centroid mean", cents[green].mean(0).round(3), "normal mean", norms[green].mean(0).round(3))
print("green color mean", cols[green].mean(0).round(3))
# 망토 겉/안: 몸통 축(수직)에서 바깥을 향하는지
axis = np.array([cents[:, 0].mean(), cents[:, 1].mean()])
radial = cents[green][:, :2] - axis
radial /= np.linalg.norm(radial, axis=1, keepdims=True) + 1e-9
facing = (norms[green][:, :2] * radial).sum(1)
print("green facing outward", int((facing > 0).sum()), "inward", int((facing <= 0).sum()))
print("green by z bands", np.histogram(cents[green][:, 2], bins=6)[0], np.histogram(cents[green][:, 2], bins=6)[1].round(2))
print("y range green (front -/back +?)", np.percentile(cents[green][:, 1], [5, 50, 95]).round(3))
