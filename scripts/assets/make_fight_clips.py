"""Give every unit a mixed fight clip: MotionBricks walk-in, the unit's own Kimodo attack, recovery.

Same attack and speed per unit as make_moves.py: golems (rooks) punch_combo at 1.2, everyone
else sword_swing at 1.3. The SOMA clip is made once per attack (motionbricks_fight.py, CPU
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
UNITS = [f"{a}_{r}" for a in "wb" for r in "pnbrqk"]
# attack preset -> speed, matching make_moves.py's MOVES["attack"] and GOLEM_ATTACK
ATTACKS = {"sword_swing": 1.3, "punch_combo": 1.2}


def attack_for(unit):
    return "punch_combo" if unit.endswith("_r") else "sword_swing"


def make_clip(attack):
    out = CLIPS / f"{attack}_fight.npz"
    command = ["uv", "run", "--no-project", "--python", "3.12", "--with", "onnxruntime", "--with", "numpy",
               "--with", "usd-core", "python", str(HERE / "motionbricks_fight.py"),
               "--attack", attack, "--speed", str(ATTACKS[attack]), "--out", str(out)]
    proc = subprocess.run(command, capture_output=True, text=True)
    print(proc.stdout.strip() or proc.stderr[-600:], flush=True)
    if proc.returncode != 0 or not out.exists():
        sys.exit(f"MotionBricks clip for {attack} failed")
    return out


def retarget(unit, clips):
    out = OUT / f"{unit}_fight.glb"
    command = autorig_api.animate_command(FINAL / f"{unit}_rigged.glb", clips[attack_for(unit)], out, 0.0, 1.0)
    proc = subprocess.run(command, cwd=str(LAB), capture_output=True, text=True,
                          env={**os.environ, "HF_HUB_OFFLINE": "1"})
    status = "ok" if proc.returncode == 0 and out.exists() else "FAILED " + (proc.stdout + proc.stderr)[-600:]
    print(f"{unit} fight ({attack_for(unit)}): {status}", flush=True)
    return status == "ok"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=",".join(UNITS))
    parser.add_argument("--jobs", type=int, default=4)
    args = parser.parse_args()
    units = args.only.split(",")
    OUT.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    clips = {attack: make_clip(attack) for attack in sorted({attack_for(u) for u in units})}
    with ThreadPoolExecutor(args.jobs) as pool:
        results = list(pool.map(lambda unit: retarget(unit, clips), units))
    print(f"ALL DONE: {sum(results)}/{len(results)} ok", flush=True)
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
