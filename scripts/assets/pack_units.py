"""Pack each unit's mesh, skeleton and five moves into one GLB for the game.

Run with Blender:
    Blender -b -P scripts/assets/pack_units.py [-- w_p,b_r]
Loads <unit>_idle.glb (mesh + idle), takes the action from each move GLB made by
make_moves.py (same skeleton), names the clips idle / attack / hit / death / walk, and
exports public/models/armies/<unit>.glb for the game, web-sized: textures shrunk to
1024 px WebP and the mesh Draco-compressed (three.js's own decoder, served from
public/draco/). Props are not baked in: the game attaches them from loadout.json so
battle scenes can drop or swap them (pack_props.py packs those).
"""
import sys
from pathlib import Path

import bpy

FINAL = Path.home() / "image-to-3dlab" / "output" / "armies-final"
GAME = Path(__file__).resolve().parents[2] / "public" / "models" / "armies"
TEXTURE = 1024
UNITS = [f"{a}_{r}" for a in "wb" for r in "pnbrqk"]
MOVES = ["attack", "hit", "death", "walk"]


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def take_action(objs, name):
    arm = next(o for o in objs if o.type == "ARMATURE")
    action = arm.animation_data.action
    action.name = name
    action.use_fake_user = True
    return action


def shrink_images(size):
    for image in bpy.data.images:
        if image.size[0] > size or image.size[1] > size:
            image.scale(min(size, image.size[0]), min(size, image.size[1]))


def export_web(path, **extra):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                              export_image_format="WEBP", export_image_quality=85,
                              export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, **extra)


def pack(unit):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body = import_glb(FINAL / f"{unit}_idle.glb")
    arm = next(o for o in body if o.type == "ARMATURE")
    take_action(body, "idle")
    for move in MOVES:
        objs = import_glb(FINAL / "moves" / f"{unit}_{move}.glb")
        take_action(objs, move)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in body:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    shrink_images(TEXTURE)
    out = GAME / f"{unit}.glb"
    export_web(out, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True)
    print("PACKED", unit, out, flush=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for unit in (argv[0].split(",") if argv else UNITS):
        pack(unit)


if __name__ == "__main__":
    main()
