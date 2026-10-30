"""Render GLBs side by side from the same four angles under the same lights.

Each row is one model (front, three-quarter, side, back), labelled with its name.
    /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/assets/render_compare.py -- \
        OUT.png "Label A=/path/a.glb" "Label B=/path/b.glb"
"""
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
out_png, entries = Path(args[0]), [a.split("=", 1) for a in args[1:]]
VIEWS = [("Front", 0), ("Three-quarter", 35), ("Side", 90), ("Back", 180)]
SIZE = 512
tmp = out_png.parent / "_tiles"
tmp.mkdir(parents=True, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {
        e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.16, 0.16, 0.18, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world
    for name, rot, energy in (("key", (50, 0, 30), 4.0), ("fill", (60, 0, -120), 1.5), ("rim", (40, 0, 180), 2.5)):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        light.data.energy = energy
        light.rotation_euler = [math.radians(v) for v in rot]
        scene.collection.objects.link(light)
    return scene


tiles = []
for label, glb in entries:
    scene = reset()
    if glb.endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=glb)
    else:
        bpy.ops.import_scene.gltf(filepath=glb)
    bpy.context.view_layer.update()  # imported parents' transforms aren't in matrix_world until this runs
    if os.environ.get("RENDER_FRAME"):  # pose animated GLBs mid-move (frame number)
        scene.frame_set(int(os.environ["RENDER_FRAME"]))
    meshes = [o for o in scene.objects if o.type == "MESH"]
    # Frame on the 0.5-99.5 percentile of vertices, so stray floater specks can't shrink the figure.
    pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    def pct(axis, q):
        vals = sorted(getattr(p, axis) for p in pts)
        return vals[int(q * (len(vals) - 1))]
    lo = Vector((pct("x", 0.005), pct("y", 0.005), pct("z", 0.005)))
    hi = Vector((pct("x", 0.995), pct("y", 0.995), pct("z", 0.995)))
    centre, height = (lo + hi) / 2, max(hi - lo)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = height * 1.15
    scene.collection.objects.link(cam)
    scene.camera = cam
    for view, deg in VIEWS:
        a = math.radians(deg)
        cam.location = centre + Vector((math.sin(a), -math.cos(a), 0.15)) * height * 3
        cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
        path = tmp / f"{label}_{view}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        tiles.append((label, view, path))

# Stitch: one row per model, a label strip on the left.
rows = len(entries)
sheet = bpy.data.images.new("sheet", SIZE * len(VIEWS), SIZE * rows)
pixels = [0.0] * (SIZE * len(VIEWS) * SIZE * rows * 4)
for i, (label, view, path) in enumerate(tiles):
    img = bpy.data.images.load(str(path))
    src = list(img.pixels)
    r, c = i // len(VIEWS), i % len(VIEWS)
    row_from_bottom = rows - 1 - r
    for y in range(SIZE):
        dst = ((row_from_bottom * SIZE + y) * SIZE * len(VIEWS) + c * SIZE) * 4
        pixels[dst:dst + SIZE * 4] = src[y * SIZE * 4:(y + 1) * SIZE * 4]
sheet.pixels = pixels
sheet.filepath_raw = str(out_png)
sheet.file_format = "PNG"
sheet.save()
print("rows:", [label for label, _ in entries], "->", out_png)
