"""Build all 12 unit models: ivory army with Pixal3D, dark-steel army with Hunyuan3D 2.1.

Every unit then goes through AssetFurnace's auto-rig and gets an idle move, so both
armies share one skeleton style and move set. Units run one at a time (the generators
each want most of the GPU). Progress goes to stdout; a unit that fails is reported and
the batch moves on.

Needs AssetFurnace's agent server: ~/image-to-3dlab/lab mcp --http  (port 8779).
    python3 scripts/assets/build_armies.py [--only w_p,b_p]
"""
import argparse
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CONCEPTS = Path.home() / "ComfyUI" / "output" / "battle-chess"
HUNYUAN_PY = Path.home() / "hunyuan3d-2.1-mac" / "venv" / "bin" / "python"
HUNYUAN_OUT = Path.home() / "hunyuan3d-2.1-mac" / "outputs" / "armies"
BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
MCP_URL = "http://127.0.0.1:8779/mcp"
RESULTS = REPO / "scripts" / "assets" / "armies.json"

# Concept seed picked per unit from the contact sheets (2026-10-29).
PICKS = {"w_p": 2, "w_n": 2, "w_b": 1, "w_r": 2, "w_q": 2, "w_k": 2,
         "b_p": 2, "b_n": 2, "b_b": 2, "b_r": 2, "b_q": 12, "b_k": 2}  # b_q 12: shorter-cloak prompt
NAMES = {"p": "pawn", "n": "knight", "b": "bishop", "r": "rook golem", "q": "queen", "k": "king"}


class Mcp:
    """Just enough MCP-over-HTTP to call AssetFurnace's tools."""

    def __init__(self):
        self.sid = None
        self._post({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "battle-chess-build-armies", "version": "1"}}})
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def _post(self, payload):
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if self.sid:
            headers["Mcp-Session-Id"] = self.sid
        req = urllib.request.Request(MCP_URL, json.dumps(payload).encode(), headers)
        with urllib.request.urlopen(req, timeout=3600) as r:
            self.sid = r.headers.get("Mcp-Session-Id", self.sid)
            body = r.read().decode()
        msgs = [json.loads(line[5:]) for line in body.splitlines() if line.startswith("data:")]
        return msgs or ([json.loads(body)] if body.strip() else [])

    def call(self, tool, **args):
        msgs = self._post({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                           "params": {"name": tool, "arguments": args}})
        res = msgs[-1].get("result", {})
        text = "\n".join(c["text"] for c in res.get("content", []) if c.get("type") == "text")
        if res.get("isError") or "error" in msgs[-1]:
            raise RuntimeError(f"{tool}: {text or msgs[-1]}")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"text": text}


def wait_run(mcp, run_id):
    while True:
        status = mcp.call("run_status", run_id=run_id, wait_seconds=50)
        if status.get("status") in ("done", "error", "failed", "cancelled"):
            if status["status"] != "done":
                raise RuntimeError(f"run {run_id} {status['status']}: {status.get('error')}")
            return status


def rig(mcp, unit, **source):
    """Create through AssetFurnace up to an animated idle; returns the run's result."""
    run = mcp.call("create", want="character", description=f"battle chess {unit} {NAMES[unit[2]]}",
                   finish_detail="more", stop_after="animated", move="idle", **source)
    return wait_run(mcp, run["run_id"])


def build_white(mcp, unit, image):
    return rig(mcp, unit, image_path=str(image), engine="pixal3d")


def build_black(mcp, unit, image):
    out = HUNYUAN_OUT / unit
    subprocess.run([str(HUNYUAN_PY), str(REPO / "scripts/assets/hunyuan21_generate.py"), str(image), str(out),
                    "--views", "8", "--res", "768", "--texture", "2048"], check=True)
    glb = out / f"{unit}.glb"
    subprocess.run([BLENDER, "-b", "-P", str(REPO / "scripts/assets/obj_to_glb.py"), "--",
                    str(out / "shape_clean_textured.obj"), str(glb)], check=True, capture_output=True)
    return rig(mcp, unit, model_path=str(glb))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=",".join(PICKS))
    args = parser.parse_args()
    results = json.loads(RESULTS.read_text()) if RESULTS.exists() else {}
    mcp = Mcp()
    for unit in args.only.split(","):
        image = CONCEPTS / f"{unit}_s{PICKS[unit]}_00001_.png"
        started = time.time()
        print(f"== {unit} ({NAMES[unit[2]]}) from {image.name}", flush=True)
        try:
            done = (build_white if unit.startswith("w") else build_black)(mcp, unit, image)
            results[unit] = {"asset_id": done.get("asset_id"), "made": done.get("made"),
                             "seconds": round(time.time() - started)}
            print(f"   done in {results[unit]['seconds']}s: {done.get('asset_id')}", flush=True)
        except Exception as exc:  # keep going; report at the end
            results[unit] = {"error": str(exc)[:500], "seconds": round(time.time() - started)}
            print(f"   FAILED: {exc}", flush=True)
        RESULTS.write_text(json.dumps(results, indent=1))
    failed = [u for u, r in results.items() if "error" in r]
    print("ALL DONE" + (f", failed: {failed}" if failed else ""), flush=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
