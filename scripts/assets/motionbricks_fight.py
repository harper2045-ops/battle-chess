"""Fight test: chain MotionBricks generations through key poses taken from Kimodo's sword swing.

MotionBricks has no attack moves, but it fills in motion between poses. So:
  1. idle -> the swing's wind-up (sword raised), placed `--distance` m ahead: walk in + raise
  2. wind-up -> the swing's follow-through (sword down), same spot: MotionBricks makes the strike
  3. follow-through -> fight stance, same spot: recover
The segments are joined into one packed Kimodo clip (see motionbricks_walkin.py), so
AssetFurnace's animate_command puts it on a unit. Runs on the CPU, like the walk-in:
    uv run --no-project --python 3.12 --with onnxruntime --with numpy --with usd-core \
        python scripts/assets/motionbricks_fight.py --out /tmp/fight.npz
"""
import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motionbricks_walkin import (FPS, MOTIONS, POSES_PER_TOKEN, Generator,  # noqa: E402
                                 load_motion, place_target, save_clip, world_positions)

# Kimodo sword_swing frames (75 at 30 Hz, two overhead strikes; the first is used).
# Right hand highest around 10-13, lowest after the strike around 22-25 (measured 2026-11-12).
WIND_UP = slice(10, 14)
FOLLOW_THROUGH = slice(22, 26)


def clip_poses(name):
    rot, j0, hips = load_motion(MOTIONS / f"{name}.npz")
    return world_positions(rot, j0, hips), rot, j0


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--distance", type=float, default=1.2, help="metres to walk in")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    gen = Generator()
    idle_pos, idle_rot, j0 = clip_poses("idle")
    swing_pos, swing_rot, _ = clip_poses("sword_swing")
    stance_pos, stance_rot, _ = clip_poses("fight_stance")

    c_pos, c_rot = idle_pos[-POSES_PER_TOKEN:], idle_rot[-POSES_PER_TOKEN:]
    # The swing's own poses keep their relative placement: place the wind-up, then put the
    # follow-through and the stance where they sit relative to it.
    up_pos, up_rot = place_target(swing_pos[WIND_UP], swing_rot[WIND_UP], c_pos, args.distance)
    steps = [("walk in + wind up", up_pos, up_rot, set(range(10, 17)))]

    segments, hips_all, rots_all = [], [], []
    # Each later target sits at 0 m from the end of the previous segment.
    for label, t_pos, t_rot, allowed in steps:
        hips, rots, tokens = gen.generate(c_pos, c_rot, t_pos, t_rot, allowed)
        segments.append((label, tokens, len(hips)))
        hips_all.append(hips)
        rots_all.append(rots)
        c_pos = world_positions(rots[-POSES_PER_TOKEN:], j0, hips[-POSES_PER_TOKEN:])
        c_rot = rots[-POSES_PER_TOKEN:]
        if label.startswith("walk"):
            down_pos, down_rot = place_target(swing_pos[FOLLOW_THROUGH], swing_rot[FOLLOW_THROUGH], c_pos, 0.0)
            steps.append(("strike", down_pos, down_rot, set(range(6, 9))))
        elif label == "strike":
            st_pos, st_rot = place_target(stance_pos[:1], stance_rot[:1], c_pos, 0.0)
            steps.append(("recover", st_pos, st_rot, set(range(6, 10))))

    # Drop each joined segment's first frame: it repeats the previous segment's last pose.
    hips = np.concatenate([hips_all[0]] + [h[1:] for h in hips_all[1:]])
    rots = np.concatenate([rots_all[0]] + [r[1:] for r in rots_all[1:]])
    save_clip(args.out, hips, rots, j0)
    for label, tokens, frames in segments:
        print(f"  {label}: {tokens} tokens, {frames} frames ({frames / FPS:.2f} s)")
    print(f"{args.out}: {len(hips)} frames ({len(hips) / FPS:.2f} s)")


if __name__ == "__main__":
    main()
