"""Give every unit the moves the board's captures play: attack, hit, death, walk.

Idle already exists (build_armies.py). Uses AssetFurnace's own retarget on each unit's
final rigged GLB. Golems punch (they hold no weapon); everyone else swings overhead.
Kimodo strikes are slow next to real ones, so attacks play a little faster. Run with
AssetFurnace's venv:
    ~/image-to-3dlab/.venv/bin/python scripts/assets/make_moves.py [--only w_p,b_r]
"""
import argparse
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

LAB = Path.home() / "image-to-3dlab"
sys.path[:0] = [str(LAB / "viewer"), str(LAB / "scripts"), str(LAB)]
import autorig_api  # noqa: E402

FINAL = LAB / "output" / "armies-final"
OUT = FINAL / "moves"
UNITS = [f"{a}_{r}" for a in "wb" for r in "pnbrqk"]
# game clip name -> (preset, speed)
MOVES = {"attack": ("sword_swing", 1.3), "hit": ("hit_react", 1.0), "death": ("death", 1.0),
         "walk": ("walk", 1.0)}
GOLEM_ATTACK = ("punch_combo", 1.2)


def make(unit, name):
    preset, speed = GOLEM_ATTACK if (name == "attack" and unit.endswith("_r")) else MOVES[name]
    out = OUT / f"{unit}_{name}.glb"
    command = autorig_api.animate_command(FINAL / f"{unit}_rigged.glb", autorig_api.MOTIONS / f"{preset}.npz",
                                          out, 0.0, speed)
    proc = subprocess.run(command, cwd=str(LAB), capture_output=True, text=True,
                          env={**os.environ, "HF_HUB_OFFLINE": "1"})
    status = "ok" if proc.returncode == 0 and out.exists() else "FAILED " + (proc.stdout + proc.stderr)[-600:]
    print(f"{unit} {name} ({preset}): {status}", flush=True)
    return status == "ok"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=",".join(UNITS))
    parser.add_argument("--jobs", type=int, default=4)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [(u, m) for u in args.only.split(",") for m in MOVES]
    with ThreadPoolExecutor(args.jobs) as pool:
        results = list(pool.map(lambda job: make(*job), jobs))
    print(f"ALL DONE: {sum(results)}/{len(results)} ok", flush=True)
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
