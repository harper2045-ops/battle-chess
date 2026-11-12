"""Fight clip: MotionBricks joins around a Kimodo attack, in one continuous motion.

MotionBricks has no attack moves, but it fills in motion between poses. So, for
`--attack` (sword_swing, or punch_combo for the rook golems):
  1. idle -> the attack's wind-up, placed `--distance` m ahead: walk in + wind up
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

from kimodo_retarget import matrices_to_quaternions, quaternions_to_matrices  # noqa: E402


# Kimodo attack -> (strike frames, walk-in metres). The strike's first four frames are the
# wind-up MotionBricks walks into; its last four the follow-through it recovers from.
ATTACKS = {
    # 75 frames at 30 Hz, two overhead strikes; the first is used. Right hand highest
    # around 10-13, lowest after the strike around 22-25 (measured 2026-11-12).
    "sword_swing": (slice(10, 26), 1.2),
    # 90 frames: guard 0-12, then left-right punches stepping ~1.3 m forward, back in guard
    # by 78 (measured 2026-11-12). The whole combo is the strike; it travels on its own, so
    # the walk-in is shorter.
    "punch_combo": (slice(12, 80), 0.5),
}


def clip_poses(name):
    rot, j0, hips = load_motion(MOTIONS / f"{name}.npz")
    return world_positions(rot, j0, hips), rot, j0


def speed_up(rot, hips, speed):
    """Resample frames to play `speed` times faster (rotations by normalised quaternion
    lerp, hips linearly), like the game's attack speed (make_moves.py: swords 1.3, punches 1.2)."""
    if speed == 1.0:
        return rot, hips
    q = matrices_to_quaternions(rot)
    for t in range(1, len(q)):  # keep each joint on one hemisphere so lerp takes the short way
        flip = np.einsum("jq,jq->j", q[t], q[t - 1]) < 0
        q[t, flip] *= -1
    times = np.arange(0, len(rot) - 1 + 1e-9, speed)
    i = np.minimum(times.astype(int), len(rot) - 2)
    w = (times - i)[:, None]
    q_new = q[i] * (1 - w[..., None]) + q[i + 1] * w[..., None]
    return quaternions_to_matrices(q_new), hips[i] * (1 - w) + hips[i + 1] * w


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--attack", choices=sorted(ATTACKS), default="sword_swing")
    parser.add_argument("--speed", type=float, default=1.0, help="play the strike this much faster")
    parser.add_argument("--distance", type=float, help="metres to walk in (default: per attack)")
    parser.add_argument("--strike", choices=["kimodo", "motionbricks"], default="kimodo",
                        help="kimodo: play Kimodo's own strike frames between the joins (the mix); "
                             "motionbricks: let MotionBricks invent the strike (softer, first test)")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    gen = Generator()
    swing, walk_in = ATTACKS[args.attack]
    distance = walk_in if args.distance is None else args.distance
    idle_pos, idle_rot, j0 = clip_poses("idle")
    a_rot, _, a_hips = load_motion(MOTIONS / f"{args.attack}.npz")
    a_rot, a_hips = speed_up(a_rot[swing], a_hips[swing], args.speed)
    swing_pos, swing_rot = world_positions(a_rot, j0, a_hips), a_rot
    swing = slice(0, len(a_rot))
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

    # The whole strike, wind-up to follow-through, placed `distance` ahead of the idle.
    c_pos, c_rot = idle_pos[-POSES_PER_TOKEN:], idle_rot[-POSES_PER_TOKEN:]
    s_pos, s_rot = place_target(swing_pos[swing], swing_rot[swing], c_pos, distance)
    n_up = POSES_PER_TOKEN
    follow_through = slice(len(a_rot) - POSES_PER_TOKEN, len(a_rot))

    # 1. MotionBricks: walk in and wind up, ending on the strike's first pose.
    hips, rots, tokens = gen.generate(c_pos, c_rot, s_pos[:n_up], s_rot[:n_up], set(range(10, 17)))
    add("walk in + wind up (MotionBricks)", hips, rots, tokens)

    if args.strike == "kimodo":
        # 2. Kimodo's own strike frames, unchanged, so the hit keeps its speed.
        add("strike (Kimodo)", s_pos[:, 0], s_rot)
        c_pos, c_rot = s_pos[-POSES_PER_TOKEN:], s_rot[-POSES_PER_TOKEN:]
    else:
        # 2. MotionBricks invents the strike from the raised pose to the follow-through.
        c_pos, c_rot = tail(hips, rots)
        down_pos, down_rot = place_target(swing_pos[follow_through], swing_rot[follow_through], c_pos, 0.0)
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
