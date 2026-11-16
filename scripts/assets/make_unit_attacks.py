"""Make each chess piece its own attack with Kimodo, two takes each (take 0 white, take 1 black).

Kimodo (~/kimodo, model Kimodo-SOMA-RP-v1.2) turns each prompt into motion on the CPU only:
TEXT_ENCODER_DEVICE=cpu, and Kimodo itself only uses NVIDIA GPUs, never the Mac's. Its
foot-slide cleanup (MotionCorrection, C++) does not build on Apple Silicon, so clips are made
with --no-postprocess. Each take is packed with AssetFurnace's pack_kimodo_clip.py, and
make_fight_clips.py then joins it to MotionBricks' walk-in and recovery. Run with AssetFurnace's venv:
    ~/image-to-3dlab/.venv/bin/python scripts/assets/make_unit_attacks.py [--only p,r]
Writes ~/image-to-3dlab/output/armies-final/attacks/<piece>_attack_<take>.npz and attacks.json.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np

LAB = Path.home() / "image-to-3dlab"
sys.path.insert(0, str(LAB / "scripts"))
from pack_kimodo_clip import pack  # noqa: E402

KIMODO = Path.home() / "kimodo"
MODEL = "Kimodo-SOMA-RP-v1.2"
SEED = 1
TAKES = 2  # take 0 for white, take 1 for black
OUT = LAB / "output" / "armies-final" / "attacks"
RAW = OUT / "raw"

# piece -> (prompt, seconds). Kimodo's docs: start each prompt with "A person...".
ATTACKS = {
    "p": ("A person thrusts a spear forward twice with both hands.", 3.0),
    "n": ("A person bashes forward with a shield in the left hand, then slashes sideways "
          "with a sword in the right hand.", 3.5),
    "b": ("A person swings a mace sideways with the right hand in one heavy smash.", 3.0),
    "q": ("A person raises a staff high with both hands, then thrusts it forward to cast a spell.", 3.5),
    "k": ("A person lifts a heavy sword over the head with both hands and cleaves straight down.", 3.5),
    # The rooks are stone golems: no weapon, a two-fist slam.
    "r": ("A person raises both fists above the head and slams them down in front.", 3.0),
}


def generate(piece):
    prompt, seconds = ATTACKS[piece]
    stem = RAW / f"{piece}_attack"
    env = {**os.environ, "PYTHONPATH": str(KIMODO), "HF_HUB_OFFLINE": "1", "TEXT_ENCODER_MODE": "local",
           "TEXT_ENCODER_DEVICE": "cpu", "CUDA_VISIBLE_DEVICES": ""}
    command = [str(KIMODO / ".venv/bin/python"), "-m", "kimodo.scripts.generate", prompt, "--model", MODEL,
               "--duration", str(seconds), "--num_samples", str(TAKES), "--seed", str(SEED),
               "--no-postprocess", "--output", str(stem)]
    proc = subprocess.run(command, cwd=str(KIMODO), env=env, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(f"Kimodo failed for {piece}: {proc.stderr[-800:]}")
    entries = []
    for take in range(TAKES):
        data = np.load(stem / f"{stem.name}_{take:02d}.npz")
        target = OUT / f"{piece}_attack_{take}.npz"
        np.savez_compressed(target, **pack(data["global_rot_mats"], data["posed_joints"]))
        entries.append({"id": target.stem, "piece": piece, "prompt": prompt, "seconds": seconds,
                        "made_with": MODEL, "seed": SEED, "take": take, "postprocess": False})
        print(f"{target.name}: {len(data['posed_joints'])} frames", flush=True)
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", default=",".join(ATTACKS))
    args = parser.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    meta_path = OUT / "attacks.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {
        "license": "Clips made with NVIDIA Kimodo (NVIDIA Open Model License). NVIDIA claims no ownership of outputs.",
        "attacks": []}
    for piece in args.only.split(","):
        entries = generate(piece)
        meta["attacks"] = [a for a in meta["attacks"] if a["piece"] != piece] + entries
    meta_path.write_text(json.dumps(meta, indent=1) + "\n")
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
