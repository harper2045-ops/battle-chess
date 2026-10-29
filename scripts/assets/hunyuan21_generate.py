"""Image -> textured mesh with Hunyuan3D 2.1 (the Apple Silicon port in ~/hunyuan3d-2.1-mac).

Reuses that port's own app functions, then adds what Tencent's official app does and
the port skips: floater and degenerate-face clean-up before painting, and the official
paint quality (README: 6 views at 512 px; official app: 8 views at 768 px).

The port refuses those paint settings on Macs because, without flash attention, the
multiview attention matrix is tens of GiB. Its own chunked attention patch computes the
same result exactly in query slices, so we allow it (HY3D_ALLOW_RISKY_TEXTURING). For
8 x 768 that isn't enough: this script also caps PyTorch's memory, replaces MPS SDPA
with plain sliced attention, chunks the feed-forward, and runs a memory watchdog.

    ~/hunyuan3d-2.1-mac/venv/bin/python scripts/assets/hunyuan21_generate.py IMAGE OUT_DIR \
        --views 8 --res 768      # about 13 min on the M5 Max; 6 x 512 about 3 min
"""
import argparse
import os
import sys
import time
from pathlib import Path

PORT = Path.home() / "hunyuan3d-2.1-mac"
GIB = 1 << 30


def start_watchdog(log_path, min_free_gib, max_swap_gib):
    """Log memory every 5 s and SIGKILL this process before macOS runs out.

    GPU memory on Apple Silicon is wired, so macOS can't page it out; when it runs
    short it compresses and swaps everything else until its own watchdog starves.
    Killing ourselves releases the GPU memory at once.
    """
    import signal
    import threading

    import psutil

    log_path.parent.mkdir(parents=True, exist_ok=True)
    base_swap = psutil.swap_memory().used

    def watch():
        with open(log_path, "a") as log:
            while True:
                free = psutil.virtual_memory().available / GIB
                swap = (psutil.swap_memory().used - base_swap) / GIB
                log.write(f"{time.strftime('%H:%M:%S')} available={free:.1f}GiB swap_growth={swap:.1f}GiB\n")
                log.flush()
                if free < min_free_gib or swap > max_swap_gib:
                    msg = f"WATCHDOG: available {free:.1f} GiB, swap +{swap:.1f} GiB, killing the run"
                    log.write(msg + "\n")
                    log.flush()
                    print(msg, flush=True)
                    os.kill(os.getpid(), signal.SIGKILL)
                time.sleep(5)

    threading.Thread(target=watch, daemon=True).start()


def use_plain_chunked_attention(budget_bytes):
    """Replace MPS SDPA with plain matmul -> softmax -> matmul, sliced to a budget.

    PyTorch's MPS `scaled_dot_product_attention` runs through MPSGraph, which keeps
    its own scratch buffers per tensor shape outside PyTorch's allocator. At
    8 x 768 those reached 21.8 GiB ("other allocations") even with the port's query
    slicing. Doing the three steps ourselves keeps every byte in PyTorch's pool, so
    each slice is freed before the next one starts. Same maths, same result.
    """
    import math

    import torch
    import torch.nn.functional as F

    def attention(query, key, value, attn_mask=None, dropout_p=0.0, is_causal=False, scale=None, **_):
        if is_causal or dropout_p:
            raise NotImplementedError("the paint UNet uses neither causal masks nor dropout")
        scale = scale if scale is not None else 1 / math.sqrt(query.shape[-1])
        lead, len_q, len_k = query.shape[:-2], query.shape[-2], key.shape[-2]
        q = query.reshape(-1, len_q, query.shape[-1])
        k = key.reshape(-1, len_k, key.shape[-1]).transpose(1, 2)
        v = value.reshape(-1, len_k, value.shape[-1])
        mask = None if attn_mask is None else attn_mask.expand(*lead, len_q, len_k).reshape(-1, len_q, len_k)
        out = torch.empty(q.shape[0], len_q, v.shape[-1], dtype=query.dtype, device=query.device)
        # Two score-sized buffers live at once (scores, softmax), so give each half the budget.
        rows = max(1, (budget_bytes // 2) // (len_k * query.element_size()))
        heads_step = max(1, min(q.shape[0], rows // len_q)) if rows >= len_q else 1
        q_step = len_q if rows >= len_q else rows
        for h in range(0, q.shape[0], heads_step):
            hs = slice(h, h + heads_step)
            for s in range(0, len_q, q_step):
                qs = slice(s, s + q_step)
                scores = torch.baddbmm(mask[hs, qs], q[hs, qs], k[hs], alpha=scale) if mask is not None \
                    else torch.bmm(q[hs, qs], k[hs]).mul_(scale)
                probs = scores.softmax(dim=-1)
                del scores
                torch.bmm(probs, v[hs], out=out[hs, qs])
                del probs
        return out.reshape(*lead, len_q, v.shape[-1])

    F.scaled_dot_product_attention = attention
    torch.nn.functional.scaled_dot_product_attention = attention
    print(f"[attention] plain chunked attention, {budget_bytes / (1 << 30):.1f} GiB per slice", flush=True)


def enable_ff_chunking(paint_pipeline, tokens):
    """Turn on the paint UNet's built-in chunked feed-forward, remainder-safe.

    The paint transformer blocks already call `_chunked_feed_forward` when
    `_chunk_size` is set, but diffusers' version demands an exact divisor of the
    token count. Ours slices with torch.split, so any size works; the output is
    identical because the feed-forward treats each token independently.
    """
    import sys as _sys

    import torch

    def chunked(ff, hidden_states, chunk_dim, chunk_size):
        return torch.cat([ff(part) for part in hidden_states.split(chunk_size, dim=chunk_dim)], dim=chunk_dim)

    unet = paint_pipeline.models["multiview_model"].pipeline.unet
    patched = 0
    for name, mod in list(_sys.modules.items()):
        # Name first: the port's `bpy` stand-in raises on any attribute lookup.
        if name.startswith("diffusers_modules") and hasattr(mod, "_chunked_feed_forward"):
            mod._chunked_feed_forward = chunked
    for block in unet.modules():
        if hasattr(block, "_chunk_size"):
            block._chunk_size, block._chunk_dim = tokens, 1
            patched += 1
    print(f"[ff-chunk] {patched} transformer blocks now run their feed-forward in {tokens}-token slices", flush=True)


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
    parser.add_argument("--watermark", type=float, default=0.7,
                        help="PyTorch MPS memory cap as a share of the GPU working set. The port sets 0.0 "
                             "(no cap), which let 8 x 768 swap the Mac into a kernel panic; with a cap "
                             "PyTorch raises an out-of-memory error instead")
    parser.add_argument("--ff-chunk", type=int, default=0,
                        help="run each transformer feed-forward in slices of this many tokens (0 = off). "
                             "At 8 x 768 the feed-forward, not attention, ran out of memory")
    parser.add_argument("--plain-attention", action="store_true",
                        help="replace MPS SDPA with plain sliced matmul/softmax (keeps memory in PyTorch's pool)")
    parser.add_argument("--min-free-gib", type=float, default=6.0,
                        help="watchdog: kill this run if available memory drops below this")
    parser.add_argument("--max-swap-gib", type=float, default=6.0,
                        help="watchdog: kill this run if swap grows by more than this")
    parser.add_argument("--reuse-shape", action="store_true", help="skip shape gen, paint OUT_DIR/shape_clean.glb")
    args = parser.parse_args()

    # 8 views x 768 px (the official app's setting) kernel-panicked the 64 GB M5 Max with
    # the port's defaults (no memory cap, MPS SDPA). With plain sliced attention, chunked
    # feed-forward and 2 GiB slices it finished in 10 min 45 s with 14 GiB still free,
    # so above 6 x 512 those switch on by themselves.
    tokens = args.views * (args.res // 8) ** 2
    if tokens > 6 * (512 // 8) ** 2:
        args.plain_attention = True
        args.ff_chunk = args.ff_chunk or 4096
        args.budget_gib = min(args.budget_gib, 2.0)
        print(f"[large paint] {args.views} x {args.res}: plain attention, ff-chunk {args.ff_chunk}, "
              f"{args.budget_gib} GiB slices", flush=True)

    # Read by the port's patches when they load, so set before importing it.
    os.environ["HY3D_ALLOW_RISKY_TEXTURING"] = "1"
    os.environ["HY3D_SDPA_BUDGET_GIB"] = str(args.budget_gib)
    os.environ["PYTORCH_MPS_HIGH_WATERMARK_RATIO"] = str(args.watermark)  # the port only setdefault()s it
    # The low watermark (default 1.4 on Apple Silicon) must not exceed the high one.
    os.environ["PYTORCH_MPS_LOW_WATERMARK_RATIO"] = str(round(args.watermark * 0.8, 3))
    start_watchdog(Path(args.out_dir).resolve() / "memory.log", args.min_free_gib, args.max_swap_gib)
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
    overrides = {"max_num_view": args.views, "resolution": args.res, "texture_size": args.texture}
    if args.plain_attention:
        use_plain_chunked_attention(int(args.budget_gib * GIB))
    if args.ff_chunk:
        enable_ff_chunking(paint.load_pipeline(app.BACKEND, "low", overrides), args.ff_chunk)
    saved = paint.texture_mesh(
        str(clean), cond, app.BACKEND, preset="low",
        overrides=overrides,
        output_dir=str(out))
    print(f"texture ({args.views} views @ {args.res}px): {time.time() - t1:.0f}s -> {saved.get('obj')}", flush=True)
    print(f"total: {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
