"""Pack the 14 weapon and shield props for the game.

Run with Blender:
    Blender -b -P scripts/assets/pack_props.py
Each Hunyuan prop is decimated to about TRIS triangles, its textures shrunk to 512 px
WebP and the mesh Draco-compressed, into public/models/armies/props/<prop>.glb. The
object's own transform is kept, so loadout.json's placement matrices still apply.
"""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack_units import export_web, import_glb, shrink_images  # noqa: E402

PROPS = Path.home() / "hunyuan3d-2.1-mac" / "outputs" / "props"
GAME = Path(__file__).resolve().parents[2] / "public" / "models" / "armies" / "props"
NAMES = ["spear", "round_shield", "kite_shield", "longsword", "mace", "staff", "greatsword"]
TRIS = 6000
TEXTURE = 512


def main():
    for prop in [f"{a}_{n}" for a in "wb" for n in NAMES]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        objs = import_glb(PROPS / prop / f"{prop}.glb")
        before = after = 0
        for obj in objs:
            if obj.type != "MESH":
                continue
            before += len(obj.data.polygons)
            if len(obj.data.polygons) > TRIS:
                mod = obj.modifiers.new("decimate", "DECIMATE")
                mod.ratio = TRIS / len(obj.data.polygons)
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.modifier_apply(modifier=mod.name)
            after += len(obj.data.polygons)
            obj.select_set(True)
        shrink_images(TEXTURE)
        export_web(GAME / f"{prop}.glb")
        print("PROP", prop, before, "->", after, flush=True)


if __name__ == "__main__":
    main()
