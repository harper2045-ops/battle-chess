"""Re-roll a unit's skeleton with AssetFurnace's own pieces until it passes, then add idle.

SkinTokens samples its skeleton (top_k 5, temperature 1), so each run is a new guess.
The blocky golems got bad ones: the black golem a single leg branch, the white one 43
bones that fold it up. This runs AssetFurnace's rig commands (SkinTokens + skin-weight
clean-up), its humanoid check, and its idle retarget, keeping the first try that is
humanoid with at most 34 bones. Extra bones were the bad sign (the folded 43-bone
golem); the black golem's 28-bone humanoid rig moves cleanly. Run with AssetFurnace's venv:
    ~/image-to-3dlab/.venv/bin/python scripts/assets/rerig.py MODEL.glb OUT_DIR [--tries 6]
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

LAB = Path.home() / "image-to-3dlab"
sys.path[:0] = [str(LAB / "viewer"), str(LAB / "scripts"), str(LAB)]
import autorig_api  # noqa: E402
import rig_check  # noqa: E402

MAX_BONES = 34  # what every humanoid unit that animated cleanly got


def run(command, cwd):
    proc = subprocess.run(command, cwd=str(cwd), capture_output=True, text=True,
                          env={**__import__("os").environ, "HF_HUB_OFFLINE": "1"})
    if proc.returncode:
        raise RuntimeError(proc.stdout[-1500:] + proc.stderr[-1500:])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--tries", type=int, default=6)
    parser.add_argument("--move", default="idle")
    parser.add_argument("--arm-spread", type=float, default=0.0)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    stem = args.model.stem

    for attempt in range(1, args.tries + 1):
        rigged = args.out_dir / f"{stem}_rig{attempt}.glb"
        for command, cwd in autorig_api.rig_commands(args.model.resolve(), rigged.resolve()):
            run(command, cwd)
        fit = rig_check.check(rigged)
        print(f"try {attempt}: humanoid={fit.get('humanoid')} bones={fit.get('bones')} {fit.get('detail', '')}",
              flush=True)
        if fit.get("humanoid") and (fit.get("bones") or 99) <= MAX_BONES:
            break
    else:
        sys.exit(f"no try out of {args.tries} gave a humanoid with at most {MAX_BONES} bones")

    motion = autorig_api.MOTIONS / f"{args.move}.npz"
    animated = args.out_dir / f"{stem}_{args.move}.glb"
    run(autorig_api.animate_command(rigged.resolve(), motion, animated.resolve(), args.arm_spread), LAB)
    print(json.dumps({"rigged": str(rigged), "animated": str(animated), "try": attempt}), flush=True)


if __name__ == "__main__":
    main()
