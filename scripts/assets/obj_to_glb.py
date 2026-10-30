"""Convert Hunyuan3D's textured OBJ (+ PBR maps) to a GLB in Blender.

The Mac port's own GLB export scrambles the texture (its UVs don't match), while the OBJ
copy is correct, so the black army goes OBJ -> Blender -> GLB. Metallic and roughness
maps are packed into glTF's combined metal-rough texture.
    /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/assets/obj_to_glb.py -- IN.obj OUT.glb
"""
import sys
from pathlib import Path

import bpy

src, dst = (Path(p) for p in sys.argv[sys.argv.index("--") + 1:][:2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(src))

maps = {kind: src.with_name(f"{src.stem}_{kind}.jpg") for kind in ("metallic", "roughness")}
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        continue
    for kind, path in maps.items():
        if path.exists():
            tex = nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(str(path))
            tex.image.colorspace_settings.name = "Non-Color"
            sep = nodes.new("ShaderNodeSeparateColor")
            links.new(tex.outputs["Color"], sep.inputs["Color"])
            # The port writes grey maps; any channel carries the value.
            links.new(sep.outputs["Red"], bsdf.inputs["Metallic" if kind == "metallic" else "Roughness"])

dst.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(dst), export_format="GLB", export_yup=True)
print("wrote", dst)
