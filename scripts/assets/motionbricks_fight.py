"""Fight clip: MotionBricks joins around Kimodo's sword swing, in one continuous motion.

MotionBricks has no attack moves, but it fills in motion between poses. So:
  1. idle -> the swing's wind-up (sword raised), placed `--distance` m ahead: walk in + raise
  2. the strike: Kimodo's own frames from wind-up to follow-through (default, `--strike
     kimodo`), or MotionBricks inventing it between those poses (`--strike motionbricks`,
     the first test: softer, 3.0 m/s hand speed against Kimodo's 4.7)
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
    parser.add_argument("--strike", choices=["kimodo", "motionbricks"], default="kimodo",
                        help="kimodo: play Kimodo's own strike frames between the joins (the mix); "
                             "motionbricks: let MotionBricks invent the strike (softer, first test)")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    gen = Generator()
    idle_pos, idle_rot, j0 = clip_poses("idle")
    swing_pos, swing_rot, _ = clip_poses("sword_swing")
    stance_pos, stance_rot, _ = clip_poses("fight_stance")
    segments, pieces = [], []

    def add(label, hips, rots, tokens=None):
        # A joined piece's first frame repeats the previous piece's last pose: drop it.
        if pieces:
            hips, rots = hips[1:], rots[1:]
        pieces.append((hips, rots))
        segments.append((label, tokens, len(hips)))

    def tail(hips, rots):
        return (world_positions(rots[-POSES_PER_TOKEN:], j0, hips[-POSES_PER_TOKEN:]),
                rots[-POSES_PER_TOKEN:])

    # The whole swing, wind-up to follow-through, placed `distance` ahead of the idle.
    c_pos, c_rot = idle_pos[-POSES_PER_TOKEN:], idle_rot[-POSES_PER_TOKEN:]
    swing = slice(WIND_UP.start, FOLLOW_THROUGH.stop)
    s_pos, s_rot = place_target(swing_pos[swing], swing_rot[swing], c_pos, args.distance)
    n_up = WIND_UP.stop - WIND_UP.start

    # 1. MotionBricks: walk in and raise the sword, ending on the swing's first wind-up pose.
    hips, rots, tokens = gen.generate(c_pos, c_rot, s_pos[:n_up], s_rot[:n_up], set(range(10, 17)))
    add("walk in + wind up (MotionBricks)", hips, rots, tokens)

    if args.strike == "kimodo":
        # 2. Kimodo's own strike frames, unchanged, so the hit keeps its speed.
        add("strike (Kimodo)", s_pos[:, 0], s_rot)
        c_pos, c_rot = s_pos[-POSES_PER_TOKEN:], s_rot[-POSES_PER_TOKEN:]
    else:
        # 2. MotionBricks invents the strike from the raised pose to the follow-through.
        c_pos, c_rot = tail(hips, rots)
        down_pos, down_rot = place_target(swing_pos[FOLLOW_THROUGH], swing_rot[FOLLOW_THROUGH], c_pos, 0.0)
        hips, rots, tokens = gen.generate(c_pos, c_rot, down_pos, down_rot, set(range(6, 9)))
        add("strike (MotionBricks)", hips, rots, tokens)
        c_pos, c_rot = tail(hips, rots)

    # 3. MotionBricks: recover into the fight stance where the strike ended.
    st_pos, st_rot = place_target(stance_pos[:1], stance_rot[:1], c_pos, 0.0)
    hips, rots, tokens = gen.generate(c_pos, c_rot, st_pos, st_rot, set(range(6, 10)))
    add("recover (MotionBricks)", hips, rots, tokens)

    hips = np.concatenate([h for h, _ in pieces])
    rots = np.concatenate([r for _, r in pieces])
    save_clip(args.out, hips, rots, j0)
    for label, tokens, frames in segments:
        made = f"{tokens} tokens, " if tokens else ""
        print(f"  {label}: {made}{frames} frames ({frames / FPS:.2f} s)")
    print(f"{args.out}: {len(hips)} frames ({len(hips) / FPS:.2f} s)")


if __name__ == "__main__":
    main()
