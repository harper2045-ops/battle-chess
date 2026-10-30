"""Build the 14 weapon and shield props (7 per army) with Hunyuan3D 2.1 at 8 views x 768.

Props get no skeleton: they are attached rigidly to a hand bone in the game. Pixal3D
was tried first (2026-10-30) and guessed thin shapes wrong from the side: the spearhead
flared into a hatchet blade with a ghost second shaft. Hunyuan's spear was right from
every side. Runs one prop at a time; outputs <prop>.glb under HUNYUAN_OUT/props.
    python3 scripts/assets/build_props.py [--only w_spear,b_spear]
"""
import argparse
import json
import subprocess
import time
from pathlib import Path

from build_armies import BLENDER, CONCEPTS, HUNYUAN_PY, REPO

OUT = Path.home() / "hunyuan3d-2.1-mac" / "outputs" / "props"
RESULTS = Path(__file__).resolve().parent / "props.json"
PROPS = ["spear", "round_shield", "kite_shield", "longsword", "mace", "staff", "greatsword"]
PICKS = {f"{a}_{p}": 1 for a in "wb" for p in PROPS}  # concept seed per prop (2026-10-30 sheet)
# Seed 1 white sword came out pointing at the camera; seed 1 white staff lost its thin
# pale shaft, so its prompt now asks for a thick gold one (seeds 3+).
PICKS.update({"w_longsword": 2, "w_staff": 3})


def build(prop):
    out = OUT / prop
    subprocess.run([str(HUNYUAN_PY), str(REPO / "scripts/assets/hunyuan21_generate.py"),
                    str(CONCEPTS / f"{prop}_s{PICKS[prop]}_00001_.png"), str(out),
                    "--views", "8", "--res", "768", "--texture", "1024"], check=True)
    glb = out / f"{prop}.glb"
    subprocess.run([BLENDER, "-b", "-P", str(REPO / "scripts/assets/obj_to_glb.py"), "--",
                    str(out / "shape_clean_textured.obj"), str(glb)], check=True, capture_output=True)
    return glb


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=",".join(PICKS))
    args = parser.parse_args()
    results = json.loads(RESULTS.read_text()) if RESULTS.exists() else {}
    for prop in args.only.split(","):
        started = time.time()
        print(f"== {prop}", flush=True)
        try:
            results[prop] = {"glb": str(build(prop)), "seconds": round(time.time() - started)}
            print(f"   done in {results[prop]['seconds']}s", flush=True)
        except Exception as exc:  # keep going; report at the end
            results[prop] = {"error": str(exc)[:500], "seconds": round(time.time() - started)}
            print(f"   FAILED: {exc}", flush=True)
        RESULTS.write_text(json.dumps(results, indent=1))
    failed = [p for p, r in results.items() if "error" in r]
    print("ALL DONE" + (f", failed: {failed}" if failed else ""), flush=True)


if __name__ == "__main__":
    main()
