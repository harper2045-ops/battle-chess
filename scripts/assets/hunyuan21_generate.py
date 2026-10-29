"""Image -> textured mesh with Hunyuan3D 2.1 (the Apple Silicon port in ~/hunyuan3d-2.1-mac).

Reuses that port's own app functions, then adds what Tencent's official app does and
the port skips: floater and degenerate-face clean-up before painting, and the official
paint quality (README: 6 views at 512 px; official app: 8 views at 768 px).

The port refuses those paint settings on Macs because, without flash attention, the
multiview attention matrix is tens of GiB. Its own chunked attention patch computes the
same result exactly in query slices, so we allow it (HY3D_ALLOW_RISKY_TEXTURING) and
give each slice a bigger budget on a large-memory Mac (HY3D_SDPA_BUDGET_GIB).

    ~/hunyuan3d-2.1-mac/venv/bin/python scripts/assets/hunyuan21_generate.py IMAGE OUT_DIR \
        --views 6 --res 512
"""
import argparse
import os
import sys
import time
from pathlib import Path

PORT = Path.home() / "hunyuan3d-2.1-mac"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("out_dir")
    parser.add_argument("--steps", type=int, default=50)
    parser.add_argument("--octree", type=int, default=384)
    parser.add_argument("--guidance", type=float, default=7.5, help="official app default")
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--views", type=int, default=6)
    parser.add_argument("--res", type=int, default=512)
    parser.add_argument("--texture", type=int, default=2048)
    parser.add_argument("--budget-gib", type=float, default=12.0,
                        help="largest attention slice; 12 GiB allocates fine on Apple Silicon")
    parser.add_argument("--reuse-shape", action="store_true", help="skip shape gen, paint OUT_DIR/shape_clean.glb")
    parser.add_argument("--allow-crash-risk", action="store_true",
                        help="paint above 6 views x 512 px; 8 x 768 kernel-panicked a 64 GB M5 Max")
    args = parser.parse_args()

    # 8 views x 768 px (the official app's setting) ran the 64 GB M5 Max out of memory
    # and kernel-panicked it on 2026-10-29. 6 x 512 (the README's setting) took 72 s.
    tokens = args.views * (args.res // 8) ** 2
    if tokens > 6 * (512 // 8) ** 2 and not args.allow_crash_risk:
        sys.exit(f"{args.views} views x {args.res} px is above 6 x 512, which is the most this Mac "
                 "has painted safely; 8 x 768 crashed it. Pass --allow-crash-risk to try anyway.")

    # Read by the port's patches when they load, so set before importing it.
    os.environ["HY3D_ALLOW_RISKY_TEXTURING"] = "1"
    os.environ["HY3D_SDPA_BUDGET_GIB"] = str(args.budget_gib)
    sys.path.insert(0, str(PORT))
    os.chdir(PORT)
    import gradio_app as app  # sets up repo paths, device and patches on import
    import paint
    from PIL import Image

    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    clean = out / "shape_clean.glb"

    t0 = time.time()
    if args.reuse_shape:
        cond = Image.open(out / "conditioning.png")
    else:
        _, state, log, _ = app.generate_3d(
            Image.open(args.image), True, args.steps, args.guidance, args.octree, args.seed, False, "en")
        print(log, flush=True)
        if state is None:
            sys.exit("shape generation failed")
        from hy3dshape.postprocessors import DegenerateFaceRemover, FloaterRemover
        mesh = DegenerateFaceRemover()(FloaterRemover()(state["mesh"]))
        mesh.export(clean)
        cond = state["image"]
        cond.save(out / "conditioning.png")
        print(f"shape: {time.time() - t0:.0f}s, {len(state['mesh'].faces)} faces, "
              f"{len(mesh.faces)} after clean-up -> {clean}", flush=True)
        app.unload_shape_pipeline()

    t1 = time.time()
    saved = paint.texture_mesh(
        str(clean), cond, app.BACKEND, preset="low",
        overrides={"max_num_view": args.views, "resolution": args.res, "texture_size": args.texture},
        output_dir=str(out))
    print(f"texture ({args.views} views @ {args.res}px): {time.time() - t1:.0f}s -> {saved.get('obj')}", flush=True)
    print(f"total: {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
