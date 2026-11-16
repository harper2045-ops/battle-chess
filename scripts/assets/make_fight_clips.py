"""Give every unit a mixed fight clip: MotionBricks walk-in, the unit's own Kimodo attack, recovery.

Each piece has its own attack from make_unit_attacks.py (spear thrusts, shield bash and slash,
mace smash, staff spell, overhead cleave, golem fist slam); white uses take 0 and black take 1,
so no two units share a motion. `--shared` is the earlier version: golems punch_combo at 1.2,
everyone else sword_swing at 1.3. The SOMA clip is made per unit (motionbricks_fight.py, CPU
only, in a throwaway uv environment), then AssetFurnace's own retarget puts it on each unit's
final rigged GLB. Run with AssetFurnace's venv:
    ~/image-to-3dlab/.venv/bin/python scripts/assets/make_fight_clips.py [--only w_p,b_r]
Writes ~/image-to-3dlab/output/armies-final/moves/<unit>_fight.glb.
"""
import argparse
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
LAB = Path.home() / "image-to-3dlab"
sys.path[:0] = [str(LAB / "viewer"), str(LAB / "scripts"), str(LAB)]
import autorig_api  # noqa: E402

FINAL = LAB / "output" / "armies-final"
OUT = FINAL / "moves"
CLIPS = FINAL / "fight-clips"
ATTACK_CLIPS = FINAL / "attacks"  # make_unit_attacks.py
UNIT_SPEED = 1.2  # own attacks play this much faster, like the presets (1.2-1.3)
UNITS = [f"{a}_{r}" for a in "wb" for r in "pnbrqk"]
# attack preset -> speed, matching make_moves.py's MOVES["attack"] and GOLEM_ATTACK
ATTACKS = {"sword_swing": 1.3, "punch_combo": 1.2}


def attack_for(unit):
    return "punch_combo" if unit.endswith("_r") else "sword_swing"


def own_attack(unit):
    """The unit's own Kimodo attack: white take 0, black take 1."""
    side, piece = unit.split("_")
    return ATTACK_CLIPS / f"{piece}_attack_{0 if side == 'w' else 1}.npz"


def make_clip(name, source):
    out = CLIPS / f"{name}_fight.npz"
    command = ["uv", "run", "--no-project", "--python", "3.12", "--with", "onnxruntime", "--with", "numpy",
               "--with", "usd-core", "python", str(HERE / "motionbricks_fight.py"), *source, "--out", str(out)]
    proc = subprocess.run(command, capture_output=True, text=True)
    print(f"{name}:", proc.stdout.strip() or proc.stderr[-600:], flush=True)
    if proc.returncode != 0 or not out.exists():
        sys.exit(f"MotionBricks clip for {name} failed")
    return out


def retarget(unit, clip, label):
    out = OUT / f"{unit}_fight.glb"
    command = autorig_api.animate_command(FINAL / f"{unit}_rigged.glb", clip, out, 0.0, 1.0)
    proc = subprocess.run(command, cwd=str(LAB), capture_output=True, text=True,
                          env={**os.environ, "HF_HUB_OFFLINE": "1"})
    status = "ok" if proc.returncode == 0 and out.exists() else "FAILED " + (proc.stdout + proc.stderr)[-600:]
    print(f"{unit} fight ({label}): {status}", flush=True)
    return status == "ok"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=",".join(UNITS))
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--shared", action="store_true", help="earlier version: shared sword/punch attacks")
    args = parser.parse_args()
    units = args.only.split(",")
    OUT.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    if args.shared:
        made = {a: make_clip(a, ["--attack", a, "--speed", str(ATTACKS[a])]) for a in {attack_for(u) for u in units}}
        jobs = [(u, made[attack_for(u)], attack_for(u)) for u in units]
    else:
        jobs = [(u, make_clip(u, ["--clip", str(own_attack(u)), "--speed", str(UNIT_SPEED)]), own_attack(u).stem)
                for u in units]
    with ThreadPoolExecutor(args.jobs) as pool:
        results = list(pool.map(lambda job: retarget(*job), jobs))
    print(f"ALL DONE: {sum(results)}/{len(results)} ok", flush=True)
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
