"""Put each unit's weapon and shield props in its hands and export an armed copy.

Run with Blender:
    Blender -b -P scripts/assets/attach_props.py [-- w_p,b_n]
For every unit in LOADOUT it loads the idle GLB, places each prop at the palm on the
idle's first frame (scaled to PROP_SIZE, held at its grip point, facing the unit's front),
parents it to the hand bone, and exports armed/<unit>_armed_idle.glb next to the final
models. It also writes scripts/assets/loadout.json, the placement the game uses:
{unit: [{"prop", "bone", "matrix"}]}, where matrix (glTF axes, column-major like
three.js Matrix4.fromArray) takes the loaded prop GLB scene to the unit's model
space at the bind pose. In three.js: offset = inverse(bone bind world) * matrix,
then bone.add(prop) with that offset.
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

REPO = Path(__file__).resolve().parents[2]
FINAL = Path.home() / "image-to-3dlab" / "output" / "armies-final"
PROPS = Path.home() / "hunyuan3d-2.1-mac" / "outputs" / "props"
HANDS = json.loads((REPO / "scripts/assets/hands.json").read_text())
OUT_JSON = REPO / "scripts/assets/loadout.json"

# role -> [(prop, hand)]. The rook golem fights with its stone fists.
LOADOUT = {"p": [("spear", "right"), ("round_shield", "left")],
           "n": [("longsword", "right"), ("kite_shield", "left")],
           "b": [("mace", "right")], "q": [("staff", "right")], "k": [("greatsword", "right")]}
# prop -> (longest side in model units, where the hand grips along the height (0 = bottom),
# how far in front of the palm it sits). Units are 2.0 tall. Swords stand point down as
# generated, so their grip is near the top. The kings' greatswords sit forward of the
# palm, or they hang inside the wide royal cloaks.
PROP_SIZE = {"spear": (2.2, 0.42, 0), "round_shield": (0.55, 0.5, 0.12), "kite_shield": (0.8, 0.55, 0.12),
             "longsword": (1.0, 0.86, 0), "mace": (0.75, 0.15, 0), "staff": (1.9, 0.45, 0),
             "greatsword": (1.15, 0.87, 0.14)}
SHIELDS = {"round_shield", "kite_shield"}

# glTF (Y up) <-> Blender (Z up): gltf = (x, z, -y)
TO_GLTF = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def palm(arm, bone_name, reach):
    """Middle of the hand: between the wrist and the knuckles (the finger roots).

    Only child bones within `reach` of the wrist count as fingers: the black king's
    hand also carries a long extra bone (cloak) that dragged the palm down his leg."""
    bone = arm.pose.bones[bone_name]  # posed: props are placed on the idle's first frame
    knuckles = [c.head for c in bone.children if (c.head - bone.head).length < reach]
    points = [bone.head] + (knuckles or [bone.tail])
    centre = sum(points, Vector()) / len(points)
    return arm.matrix_world @ centre


def frame(arm, unit, height):
    """Unit's forward and right in Blender space, from its two hands (right minus left)."""
    reach = 0.06 * height
    right = palm(arm, HANDS[unit]["right"], reach) - palm(arm, HANDS[unit]["left"], reach)
    right.z = 0
    right.normalize()
    forward = Vector((0, 0, 1)).cross(right)  # z up x right = forward (right-handed)
    return forward, right


def unit_height(arm):
    """The unit's standing height (rest pose, world space); PROP_SIZE assumes 2.0."""
    zs = [(o.matrix_world @ v.co).z for o in bpy.data.objects
          if o.type == "MESH" and o.find_armature() == arm for v in o.data.vertices]
    return max(zs) - min(zs)


def stand_upright(verts):
    """Turn a long prop so its long axis is vertical, wide end up, flat side to the front.

    Hunyuan sometimes builds a long prop leaning or lying along the view direction (the
    white longsword twice, the white staff at 30 degrees). The wide end (crossguard, mace
    head, orb, spearhead) is the top in every concept picture."""
    c = verts - verts.mean(0)
    axes = np.linalg.svd(c, full_matrices=False)[2]
    a = axes[0]
    t = c @ a
    r = np.linalg.norm(c - np.outer(t, a), axis=1)
    span = t.max() - t.min()
    if r[t < t.min() + 0.25 * span].max() > r[t > t.max() - 0.25 * span].max():
        a = -a
    up = Vector(a.tolist()).rotation_difference(Vector((0, 0, 1))).to_matrix()
    # The widest side (blade width, crossguard) goes along X, so the flat faces -Y (front).
    w = np.array(up) @ axes[1]
    spin = Matrix.Rotation(-np.arctan2(w[1], w[0]), 3, "Z")
    return (spin @ up).to_4x4()


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def place_prop(prop, arm, unit, hand):
    obj = next(o for o in import_glb(PROPS / f"{unit[0]}_{prop}" / f"{unit[0]}_{prop}.glb") if o.type == "MESH")
    # The prop file's own node turn (from the OBJ conversion) stays; we place on top of it.
    base = obj.matrix_world.copy()
    verts = np.array([(base @ v.co)[:] for v in obj.data.vertices])
    align = Matrix.Identity(4) if prop in SHIELDS else stand_upright(verts)
    verts = verts @ np.array(align.to_3x3()).T
    lo, hi = verts.min(0), verts.max(0)
    size, grip_at, ahead = PROP_SIZE[prop]
    height = unit_height(arm)
    scale = size * height / 2.0 / float((hi - lo).max())
    forward, right = frame(arm, unit, height)
    target = palm(arm, HANDS[unit][hand], 0.06 * height) + forward * (ahead * height / 2.0)
    if prop in SHIELDS:
        # The face is the thinnest direction; turn it to face the unit's front, top kept up.
        centred = verts - verts.mean(0)
        normal = Vector(np.linalg.svd(centred, full_matrices=False)[2][2])
        normal.z = 0
        if normal.length < 1e-6:
            normal = Vector((0, -1, 0))
        normal.normalize()
        if normal.y > 0:  # generated props face the camera, -Y in Blender
            normal = -normal
        turn = normal.to_track_quat("-Y", "Z").inverted()  # prop face -> -Y
        rot = forward.to_track_quat("-Y", "Z").to_matrix().to_4x4() @ turn.to_matrix().to_4x4()
        grip = Vector(((lo + hi) / 2).tolist())
    else:
        # Long props stand upright; their flat side faces the unit's front.
        rot = forward.to_track_quat("-Y", "Z").to_matrix().to_4x4()
        grip = Vector((float((lo[0] + hi[0]) / 2), float((lo[1] + hi[1]) / 2), float(lo[2] + grip_at * (hi[2] - lo[2]))))
    outer = Matrix.Translation(target) @ rot @ Matrix.Scale(scale, 4) @ Matrix.Translation(-grip) @ align
    placed = outer @ base
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = HANDS[unit][hand]
    obj.matrix_world = placed
    bpy.context.view_layer.update()
    return obj, base, {"prop": f"{unit[0]}_{prop}", "bone": HANDS[unit][hand], "hand": hand}


def arm_unit(unit):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = import_glb(FINAL / f"{unit}_idle.glb")
    arm = next(o for o in objs if o.type == "ARMATURE")
    # Place on the idle's first frame, so props stand upright while the unit idles (the
    # white queen's idle turns her hand 36 degrees from the rest pose).
    bpy.context.scene.frame_set(bpy.context.scene.frame_start)
    bpy.context.view_layer.update()
    print("HEIGHT", unit, round(unit_height(arm), 3), flush=True)
    placed = [place_prop(prop, arm, unit, hand) for prop, hand in LOADOUT[unit[2]]]
    # The game wants each placement at the bind (rest) pose, without the prop file's own turn.
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    entries = []
    for obj, base, entry in placed:
        gltf = TO_GLTF @ obj.matrix_world @ base.inverted() @ TO_GLTF.inverted()
        entries.append({**entry, "matrix": [round(gltf[r][c], 6) for c in range(4) for r in range(4)]})
    arm.data.pose_position = "POSE"
    out = FINAL / "armed" / f"{unit}_armed_idle.glb"
    out.parent.mkdir(exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_animations=True)
    return entries


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    units = argv[0].split(",") if argv else [f"{a}_{r}" for a in "wb" for r in LOADOUT]
    loadout = json.loads(OUT_JSON.read_text()) if OUT_JSON.exists() else {}
    for unit in units:
        loadout[unit] = arm_unit(unit)
        print("ARMED", unit, [e["prop"] for e in loadout[unit]], flush=True)
    OUT_JSON.write_text(json.dumps(loadout, indent=1))


if __name__ == "__main__":
    main()
