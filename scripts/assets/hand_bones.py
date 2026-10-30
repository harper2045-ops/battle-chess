"""Find each unit's hand bones, so weapon props can be attached to them.

SkinTokens names bones bone_0, bone_1, ...; AssetFurnace's body mapper (the one the
moves use) says which are the hands. Writes scripts/assets/hands.json:
{unit: {"right": bone, "left": bone, "right_pos": [x,y,z], "left_pos": [...]}} with
rest positions in glTF space (Y up). Run with AssetFurnace's venv:
    ~/image-to-3dlab/.venv/bin/python scripts/assets/hand_bones.py
"""
import json
import sys
from pathlib import Path

import numpy as np

LAB = Path.home() / "image-to-3dlab"
sys.path[:0] = [str(LAB / "scripts")]
import rig_check  # noqa: E402
from kimodo_retarget import map_skintokens_to_soma  # noqa: E402

FINAL = LAB / "output" / "armies-final"
OUT = Path(__file__).resolve().parent / "hands.json"


def main():
    hands = {}
    for glb in sorted(FINAL.glob("*_rigged.glb")):
        unit = glb.name.removesuffix("_rigged.glb")
        parents, heads = rig_check.skeleton(glb)
        mapping, _ = map_skintokens_to_soma(parents, heads, up=rig_check.Y_UP)
        entry = {}
        for side, joint in (("right", "RightHand"), ("left", "LeftHand")):
            bone = next(b for b, j in mapping.items() if j == joint and mapping.get(parents[b]) != joint)
            entry[side] = bone
            entry[f"{side}_pos"] = [round(float(v), 4) for v in np.asarray(heads[bone])]
        hands[unit] = entry
        print(unit, entry, flush=True)
    OUT.write_text(json.dumps(hands, indent=1))


if __name__ == "__main__":
    main()
