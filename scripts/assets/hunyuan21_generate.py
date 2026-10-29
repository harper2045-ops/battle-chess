"""Image -> textured GLB with Hunyuan3D 2.1 (the Apple Silicon port in ~/hunyuan3d-2.1-mac).

Reuses that port's own app functions, so a run here matches its web UI.
Run with the port's venv, from anywhere:
    ~/hunyuan3d-2.1-mac/venv/bin/python scripts/assets/hunyuan21_generate.py IMAGE OUT_DIR
"""
import argparse
import os
import sys
import time
from pathlib import Path

PORT = Path.home() / "hunyuan3d-2.1-mac"
sys.path.insert(0, str(PORT))
os.chdir(PORT)

import gradio_app as app  # noqa: E402  (sets up paths, device and patches on import)
import paint  # noqa: E402
from PIL import Image  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("out_dir")
    parser.add_argument("--steps", type=int, default=50)
    parser.add_argument("--octree", type=int, default=384)
    parser.add_argument("--guidance", type=float, default=5.0)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--preset", default="safe", help="paint preset; MPS only allows 'safe'")
    args = parser.parse_args()

    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    glb, state, log, _ = app.generate_3d(
        Image.open(args.image), True, args.steps, args.guidance, args.octree, args.seed, False, "en")
    print(log, flush=True)
    if state is None:
        sys.exit("shape generation failed")
    shape_secs = time.time() - t0
    raw = out / "shape_raw.glb"
    state["mesh"].export(raw)
    state["image"].save(out / "conditioning.png")
    print(f"shape: {shape_secs:.0f}s, {len(state['mesh'].faces)} faces -> {raw}", flush=True)

    app.unload_shape_pipeline()
    t1 = time.time()
    saved = paint.texture_mesh(str(raw), state["image"], app.BACKEND, preset=args.preset, output_dir=str(out))
    print(f"texture: {time.time() - t1:.0f}s -> {saved.get('glb') or saved.get('obj')}", flush=True)
    print(f"total: {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
