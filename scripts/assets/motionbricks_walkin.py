"""Generate a walk-in with NVIDIA MotionBricks on a Mac, starting and ending in Kimodo poses.

MotionBricks (github.com/NVlabs/motionbricks) fills in motion between four "context" poses
and one to four "target" poses on the SOMA skeleton, the same skeleton Kimodo writes. Its
bundled engines need an NVIDIA GPU (TensorRT), so this script follows the repo's official
ONNX route (docs/onnx_inference.md): ONNX Runtime on the CPU, with the engine's encode and
decode kernels (motionbricks/model/soma/kernels.py) ported line for line to numpy.

Context = the last four frames of a Kimodo clip (default idle). Target = the first frame of
another Kimodo clip (default fight_stance), placed `--distance` metres ahead. The result is
written in the packed Kimodo format (scripts/pack_kimodo_clip.py in image-to-3dlab), so
AssetFurnace's `animate_command` can put it on any unit, exactly like the Kimodo moves.

Run (onnxruntime and numpy only, in a throwaway uv environment):
    uv run --no-project --python 3.12 --with onnxruntime --with numpy \
        python scripts/assets/motionbricks_walkin.py --out /tmp/walkin.npz
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

LAB = Path.home() / "image-to-3dlab"
sys.path.insert(0, str(LAB / "scripts"))
from kimodo_retarget import (SOMA77, SOMA77_PARENTS, SOMA_INDEX, load_motion,  # noqa: E402
                             matrices_to_quaternions, soma_tpose)

MB = Path.home() / "motionbricks"
ONNX_DIR = MB / "motionbricks/assets/onnx/soma"
MOTIONS = LAB / "image_to_3dlab/motions"
FPS = 30.0
POSES_PER_TOKEN = 4
BOUNDARY = POSES_PER_TOKEN - 1
UP = np.array([0.0, 1.0, 0.0])

SKELETON_USD = MB / "motionbricks/assets/human/soma_base_skel_minimal_no_root.usd"


def rest_world():
    """World rotation and position (metres) of every joint in the SOMA skeleton's T-pose rest.

    Kimodo's world rotations are turns *away from* the T-pose (near identity when standing,
    checked 2026-11-06); MotionBricks' are full joint orientations, which include each joint's
    rest orientation in this USD (bones run along local X). So R_motionbricks = R_kimodo @ W.
    """
    from pxr import Usd, UsdSkel

    stage = Usd.Stage.Open(str(SKELETON_USD))
    skel = next(UsdSkel.Skeleton(p) for p in stage.Traverse() if p.IsA(UsdSkel.Skeleton))
    paths = [str(p) for p in skel.GetJointsAttr().Get()]
    assert [p.split("/")[-1] for p in paths] == SOMA77, "USD joint order differs from Kimodo's"
    rots, pos = {}, {}
    for path, m in zip(paths, skel.GetRestTransformsAttr().Get()):
        m = np.array(m)  # USD row-vector convention
        local_r, local_t = m[:3, :3].T, m[3, :3] / 100.0
        parent = path.rsplit("/", 1)[0]
        if parent in rots:
            rots[path] = rots[parent] @ local_r
            pos[path] = pos[parent] + rots[parent] @ local_t
        else:
            rots[path], pos[path] = local_r, local_t
    return np.array([rots[p] for p in paths]), np.array([pos[p] for p in paths])


MODEL_JOINTS = json.loads((ONNX_DIR / "soma_n1.json").read_text())["joint_names"]
MODEL_INDEX = [SOMA_INDEX[name] for name in MODEL_JOINTS]
RIGHT_LEG, LEFT_LEG = SOMA_INDEX["RightLeg"], SOMA_INDEX["LeftLeg"]


def world_positions(rots, joints0, hips):
    """Every joint's world position per frame: x_j = x_parent + G_parent @ (N_j - N_parent)."""
    rest = soma_tpose(rots, np.repeat(joints0[None], len(rots), 0), 0)
    out = np.zeros((len(rots), 77, 3))
    out[:, 0] = hips
    for j, p in enumerate(SOMA77_PARENTS):
        if p >= 0:
            out[:, j] = out[:, p] + np.einsum("tab,b->ta", rots[:, p], rest[j] - rest[p])
    return out


def heading(right_hip, left_hip):
    """kernels._heading_from_hip_positions: facing angle atan2(fwd.x, fwd.z)."""
    across = np.array([right_hip[0] - left_hip[0], 0.0, right_hip[2] - left_hip[2]])
    length = np.linalg.norm(across)
    if length <= 1e-6:
        return 0.0
    forward = np.cross(UP, across / length)
    return float(np.arctan2(forward[0], forward[2]))


def yaw(angle):
    c, s = np.cos(angle), np.sin(angle)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def encode(pos, rot, num_targets):
    """kernels.compute_guide_alignment_kernel + encode_motionbricks_inputs_kernel for 8 poses."""
    last = POSES_PER_TOKEN - 1
    current = heading(pos[last, RIGHT_LEG], pos[last, LEFT_LEG])
    desired = np.arctan2(1.0, 0.0)  # MotionBricksInferenceConfig.heading_alignment (1, 0)
    align_r = yaw(current - desired)
    align_t = np.array([pos[last, 0, 0], 0.0, pos[last, 0, 2]])
    aligned = np.einsum("ab,tjb->tja", align_r.T, pos - align_t)
    rot_al = np.einsum("ab,tjbc->tjac", align_r.T, rot)

    g = np.zeros((1, 8, 5), np.float32)
    lr = np.zeros((1, 8, 4), np.float32)
    lp = np.zeros((1, 8, 267), np.float32)
    nj = len(MODEL_JOINTS)
    for f in range(8):
        nxt = f if f == last else min(f + 1, 7)
        hips, nhips = aligned[f, 0], aligned[nxt, 0]
        h = heading(aligned[f, RIGHT_LEG], aligned[f, LEFT_LEG])
        nh = heading(aligned[nxt, RIGHT_LEG], aligned[nxt, LEFT_LEG])
        dh = np.arctan2(np.sin(nh - h), np.cos(nh - h))
        g[0, f] = [hips[0], hips[1], hips[2], np.cos(h), np.sin(h)]
        lr[0, f] = [dh * FPS, (nhips[0] - hips[0]) * FPS, (nhips[2] - hips[2]) * FPS, hips[1]]
        root = np.array([hips[0], 0.0, hips[2]])
        for m, j in enumerate(MODEL_INDEX):
            if m > 0:
                lp[0, f, (m - 1) * 3:(m - 1) * 3 + 3] = aligned[f, j] - root
            o = (nj - 1) * 3 + m * 6
            lp[0, f, o:o + 3] = rot_al[f, j][:, 0]
            lp[0, f, o + 3:o + 6] = rot_al[f, j][:, 1]

    used = np.array([[1 if i < POSES_PER_TOKEN + num_targets else 0 for i in range(8)]], np.int32)
    local_used = used.copy()
    local_used[0, POSES_PER_TOKEN - 1] = 0
    local_used[0, POSES_PER_TOKEN + num_targets - 1] = 0
    return {"global_root_values": g, "local_root_values": lr, "local_poses": lp,
            "has_global_root_values": used, "has_local_root_values": local_used,
            "has_local_poses": used.copy()}, (align_r, align_t)


def rotation_from_6d(x_raw, y_raw):
    x = x_raw / np.linalg.norm(x_raw)
    z = np.cross(x, y_raw)
    z /= np.linalg.norm(z)
    return np.stack([x, np.cross(z, x), z], axis=1)


def decode(pred, tokens, alignment):
    """kernels.decode_motionbricks_output_kernel, kept as world rotations for the model joints."""
    align_r, align_t = alignment
    nj = len(MODEL_JOINTS)
    frames = range(BOUNDARY, tokens * POSES_PER_TOKEN - BOUNDARY)
    hips = np.array([align_r @ pred[f, :3] + align_t for f in frames])
    rots = np.zeros((len(hips), nj, 3, 3))
    for i, f in enumerate(frames):
        for m in range(nj):
            o = 5 + (nj - 1) * 3 + m * 6
            rots[i, m] = align_r @ rotation_from_6d(pred[f, o:o + 3], pred[f, o + 3:o + 6])
    return hips, rots


def axis_angle_scale(r, w):
    """Rotation r scaled to fraction w of its angle."""
    angle = np.arccos(np.clip((np.trace(r) - 1) / 2, -1, 1))
    if angle < 1e-8:
        return np.eye(3)
    axis = np.array([r[2, 1] - r[1, 2], r[0, 2] - r[2, 0], r[1, 0] - r[0, 1]]) / (2 * np.sin(angle))
    k = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
    a = angle * w
    return np.eye(3) + np.sin(a) * k + (1 - np.cos(a)) * k @ k


def full_skeleton(model_rots, reference):
    """77-joint world rotations: model joints as predicted, the rest (fingers, ends) keep
    their parent-relative turn from `reference` (the last context pose), like the engine's
    reference-pose fallback."""
    model_of = {j: m for m, j in enumerate(MODEL_INDEX)}
    connected = set()
    for j, p in enumerate(SOMA77_PARENTS):
        if j in model_of and (p < 0 or p in connected):
            connected.add(j)
    out = np.zeros((len(model_rots), 77, 3, 3))
    for j, p in enumerate(SOMA77_PARENTS):
        if j in connected:
            out[:, j] = model_rots[:, model_of[j]]
        else:
            local = reference[p].T @ reference[j]
            out[:, j] = out[:, p] @ local
    return out


def endpoint_correct(hips, rots, start_hips, start_rots, end_hips, end_rots):
    """kernels.compute/apply_endpoint_deltas: start error fades out as end error fades in."""
    n = len(hips)
    w = np.linspace(0, 1, n)
    hips = hips + (1 - w)[:, None] * (start_hips - hips[0]) + w[:, None] * (end_hips - hips[-1])
    out = rots.copy()
    for j in range(rots.shape[1]):
        d0 = start_rots[j] @ rots[0, j].T
        d1 = end_rots[j] @ rots[-1, j].T
        for f in range(n):
            out[f, j] = axis_angle_scale(d1, w[f]) @ axis_angle_scale(d0, 1 - w[f]) @ rots[f, j]
    return hips, out


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--context", default="idle")
    parser.add_argument("--target", default="fight_stance")
    parser.add_argument("--distance", type=float, default=2.0, help="metres to walk (SOMA is ~1.7 m tall)")
    parser.add_argument("--tokens", default="10,11,12,13,14,15,16", help="allowed token counts, 6-16")
    parser.add_argument("--precision", choices=["fp32", "fp16"], default="fp32")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    c_rot, c_j0, c_hips = load_motion(MOTIONS / f"{args.context}.npz")
    t_rot, t_j0, t_hips = load_motion(MOTIONS / f"{args.target}.npz")
    c_pos = world_positions(c_rot, c_j0, c_hips)[-POSES_PER_TOKEN:]
    c_rot = c_rot[-POSES_PER_TOKEN:]
    t_pos, t_rot = place_target(world_positions(t_rot, t_j0, t_hips)[:1], t_rot[:1], c_pos, args.distance)

    generator = Generator(args.precision)
    tpose = soma_tpose(c_rot[:1], world_positions(c_rot[:1], c_j0, c_hips[-1:]), 0)
    shape_gap = np.abs((tpose - tpose[0]) - (generator.rest_pos - generator.rest_pos[0])).max()
    print(f"Kimodo T-pose vs MotionBricks rest: largest joint gap {shape_gap * 100:.1f} cm")

    hips, rots, tokens = generator.generate(c_pos, c_rot, t_pos, t_rot, {int(t) for t in args.tokens.split(",")})
    save_clip(args.out, hips, rots, c_j0)
    travel = np.linalg.norm((hips[-1] - hips[0])[[0, 2]])
    print(f"{args.out}: {tokens} tokens, {len(hips)} frames ({len(hips) / FPS:.2f} s), travel {travel:.2f} m")


def place_target(t_pos, t_rot, c_pos, distance):
    """Turn target poses to the last context pose's facing, `distance` metres ahead of it."""
    face_c = heading(c_pos[-1, RIGHT_LEG], c_pos[-1, LEFT_LEG])
    face_t = heading(t_pos[0, RIGHT_LEG], t_pos[0, LEFT_LEG])
    turn = yaw(face_c - face_t)
    ahead = np.array([np.sin(face_c), 0.0, np.cos(face_c)])
    t_ground = np.array([t_pos[0, 0, 0], 0.0, t_pos[0, 0, 2]])
    c_ground = np.array([c_pos[-1, 0, 0], 0.0, c_pos[-1, 0, 2]])
    return (np.einsum("ab,tjb->tja", turn, t_pos - t_ground) + c_ground + distance * ahead,
            np.einsum("ab,tjbc->tjac", turn, t_rot))


class Generator:
    """One ONNX Runtime session; generate() is one MotionBricks call in Kimodo's convention."""

    def __init__(self, precision="fp32"):
        import onnxruntime as ort

        self.rest_rot, self.rest_pos = rest_world()
        self.session = ort.InferenceSession(str(ONNX_DIR / f"mmm_v6_soma_{precision}.onnx"),
                                            providers=["CPUExecutionProvider"])

    def generate(self, c_pos, c_rot, t_pos, t_rot, allowed_tokens):
        """Four context poses + one to four target poses -> (hips [T,3], world rotations
        [T,77,3,3], token count), endpoint-corrected to the last context and first target pose."""
        n = len(t_pos)
        pad = [min(i, n - 1) for i in range(POSES_PER_TOKEN)]  # pad_token_poses_kernel
        pos = np.concatenate([c_pos, t_pos[pad]])
        rot = np.concatenate([c_rot, t_rot[pad]])
        inputs, alignment = encode(pos, rot @ self.rest_rot, num_targets=n)
        inputs["allowed_pred_num_tokens"] = np.array(
            [[1 if 6 + i in allowed_tokens else 0 for i in range(11)]], np.int32)
        outputs = dict(zip([o.name for o in self.session.get_outputs()], self.session.run(None, inputs)))
        tokens = int(outputs["pred_num_tokens"][0])
        hips, model_rots = decode(outputs["pred_global_motions"][0], tokens, alignment)
        model_rots = model_rots @ np.transpose(self.rest_rot[MODEL_INDEX], (0, 2, 1))  # back to Kimodo's
        rots = full_skeleton(model_rots, c_rot[-1])
        hips, rots = endpoint_correct(hips, rots, c_pos[-1, 0], c_rot[-1], t_pos[0, 0], t_rot[0])
        return hips, rots, tokens


def save_clip(path, hips, rots, joints0_source):
    """Packed Kimodo clip: world rotations as fp16 quaternions, frame-0 joints, hips track."""
    joints0 = world_positions(rots[:1], joints0_source, hips[:1])[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, quats=matrices_to_quaternions(rots).astype(np.float16),
                        joints0=joints0.astype(np.float32), hips=hips.astype(np.float32), fps=np.float32(FPS))


if __name__ == "__main__":
    main()
