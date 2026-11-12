"""Render an animated GLB from the side as a PNG sequence, camera fixed and fitted to the whole motion.

Used to compare moves (Kimodo vs MotionBricks) frame by frame:
    /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/assets/render_motion.py -- \
        OUT_DIR clip.glb "Label" [max_frames]
Join two sequences side by side with ffmpeg's hstack.
"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
out_dir, glb, label = Path(args[0]), args[1], args[2]
max_frames = int(args[3]) if len(args) > 3 else 999
out_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 720, 540
world = bpy.data.worlds.new("w")
world.color = (0.12, 0.13, 0.16)
scene.world = world
bpy.ops.import_scene.gltf(filepath=glb)
arm = next(o for o in scene.objects if o.type == "ARMATURE")
start, end = (int(v) for v in arm.animation_data.action.frame_range)
end = min(end, start + max_frames - 1)
scene.frame_start, scene.frame_end = start, end
# Keep the importer's frame rate (the AssetFurnace GLBs are 24 fps); print it for ffmpeg.
print("FPS", scene.render.fps)

# Fit the camera to every pose the clip passes through (sampled every third frame).
meshes = [o for o in scene.objects if o.type == "MESH"]
lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
centroids = []
for f in range(start, end + 1, 3):
    scene.frame_set(f)
    deps = bpy.context.evaluated_depsgraph_get()
    points = [o.matrix_world @ v.co for o in meshes for v in list(o.evaluated_get(deps).data.vertices)[::50]]
    for p in points:
        lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    centroids.append(sum(points, Vector()) / len(points))
centre = (lo + hi) / 2
span = max(hi.x - lo.x, hi.y - lo.y, (hi.z - lo.z) * 4 / 3) * 1.15

bpy.ops.mesh.primitive_plane_add(size=40, location=(centre.x, centre.y, lo.z))
floor_mat = bpy.data.materials.new("floor")
floor_mat.diffuse_color = (0.25, 0.25, 0.27, 1)
bpy.context.object.data.materials.append(floor_mat)

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = span
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
# Side view: look across the direction the body travels (bounding box as a fallback).
travel = centroids[-1] - centroids[0]
travel.z = 0
if travel.length > 0.2:
    side = travel.normalized().cross(Vector((0, 0, 1)))
else:
    side = Vector((1, 0, 0)) if (hi.y - lo.y) >= (hi.x - lo.x) else Vector((0, -1, 0))
cam.location = centre + side * 20
cam.rotation_euler = (-side).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (0.9, 0.3, 0.6)
scene.collection.objects.link(sun)
# Soft fill from the camera side, so the side facing the camera is never in shadow.
fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
fill.data.energy = 1.5
fill.rotation_euler = cam.rotation_euler
scene.collection.objects.link(fill)

text = bpy.data.curves.new("label", "FONT")
text.body = label
text.size = span * 0.05
label_obj = bpy.data.objects.new("label", text)
scene.collection.objects.link(label_obj)
label_obj.location = centre + side * 5 + cam.matrix_world.to_3x3() @ Vector((-span * 0.45, span * 0.32, 0))
label_obj.rotation_euler = cam.rotation_euler

scene.render.filepath = str(out_dir / "f_")
scene.render.image_settings.file_format = "PNG"
bpy.ops.render.render(animation=True)
print("RENDERED", start, end)
