"""Make unit concept images with Qwen-Image 2.1 + Lightning in the local ComfyUI.

The pictures feed the image-to-3D models (Pixal3D, Hunyuan3D 2.1), so they need a
full body, front view, A-pose and a plain background.

Run with ComfyUI's server up on :8188:
    ~/ComfyUI/.venv/bin/python scripts/assets/concept_images.py pawn --seeds 1,2,3,4
"""
import argparse
import json
import time
import urllib.request

API = "http://127.0.0.1:8188"

STYLE = (
    "Full body character concept for a 3D game model, front view, standing in a relaxed "
    "A-pose with arms angled down away from the body, feet apart and fully visible, "
    "whole figure centred with empty space around it, plain flat light grey background, "
    "even soft studio lighting, no shadows on the ground, no text. Stylised medieval "
    "fantasy, chunky readable silhouette like a premium tabletop miniature, hand-painted "
    "textures, clean shapes."
)

UNITS = {
    "pawn": "A sturdy young foot soldier spearman in polished ivory-white plate and gold trim "
            "over a blue tabard, open-faced kettle helmet, holding a long spear upright in his "
            "right hand and a small round shield on his left arm.",
}

# Units are made empty-handed: held weapons get skinned to the body and bend when the
# rig moves, so weapons and shields are separate props attached to the hand bones.
EMPTY_HANDS = ("Both hands are open and empty, holding nothing: no weapon, no shield, no staff, "
               "nothing on the back.")

# One look per army: white = ivory plate, gold trim, royal blue cloth (Pixal3D);
# black = blackened dark steel, bronze trim, deep crimson cloth (Hunyuan3D 2.1).
ARMY = {
    "w": {"metal": "polished ivory-white plate armour with gold trim", "cloth": "royal blue",
          "stone": "pale cream marble with gold inlay"},
    "b": {"metal": "blackened dark steel plate armour with bronze trim", "cloth": "deep crimson",
          "stone": "dark charcoal basalt with bronze inlay"},
}

ROLES = {
    "p": "A sturdy young foot soldier in {metal} over a {cloth} tabard, open-faced kettle helmet, "
         "leather belt and boots.",
    "n": "A tall armoured knight in full {metal}, a closed great helm with a {cloth} plume, "
         "a {cloth} surcoat, broad pauldrons and gauntlets.",
    "b": "A battle bishop: a broad-shouldered warrior priest in a tall {cloth} mitre and long {cloth} "
         "and white robes over {metal}, a gold chain with a holy symbol on his chest.",
    "r": "A hulking stone golem built like a castle tower, carved from {stone}: battlement "
         "crenellations on its shoulders and head, massive blocky arms and legs, small glowing eyes.",
    "q": "A regal sorceress queen in a fitted {cloth} gown with {metal} bodice, shoulder guards "
         "and bracers, a slim crown, long flowing hair, a cloak that ends at mid-calf. The gown "
         "and cloak stop above the ground: armoured boots and feet clearly visible, nothing "
         "trailing or pooling on the floor.",  # a pooled train became a floor slab in Hunyuan
    "k": "An old bearded warrior king in {metal} under a heavy {cloth} royal cloak with fur "
         "trim, a large jewelled crown, a broad belt.",
}
for army, look in ARMY.items():
    for role, text in ROLES.items():
        UNITS[f"{army}_{role}"] = f"{text.format(**look)} {EMPTY_HANDS}"


def post(path, body):
    req = urllib.request.Request(API + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    raw = urllib.request.urlopen(req, timeout=60).read()
    return json.loads(raw) if raw.strip() else {}


def get(path):
    return json.load(urllib.request.urlopen(API + path, timeout=60))


def graph(prompt, prefix, seed):
    return {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "qwen-image-2.1-UC-Q8_0.gguf"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_8b_bf16.safetensors", "type": "qwen_image", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"}},
        "4": {"class_type": "TextEncodeQwenImage21", "inputs": {"clip": ["2", 0], "prompt": prompt, "negative_prompt": "", "resolution": 1024}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 896, "height": 1152, "batch_size": 1}},
        "6": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "qwen-image-2.1-lightning-4step.safetensors", "strength_model": 1.0}},
        "7": {"class_type": "KSampler", "inputs": {"model": ["6", 0], "positive": ["4", 0], "negative": ["4", 1], "latent_image": ["5", 0],
                                                    "seed": seed, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["8", 0]}},
    }


def run(g):
    pid = post("/prompt", {"prompt": g})["prompt_id"]
    while True:
        hist = get(f"/history/{pid}")
        if pid in hist:
            status = hist[pid].get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError(json.dumps(status.get("messages", []))[:800])
            return [img["filename"] for node in hist[pid]["outputs"].values() for img in node.get("images", [])]
        time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("unit", choices=sorted(UNITS))
    parser.add_argument("--seeds", default="1,2,3,4")
    args = parser.parse_args()
    prompt = f"{UNITS[args.unit]} {STYLE}"
    for seed in [int(s) for s in args.seeds.split(",")]:
        started = time.time()
        files = run(graph(prompt, f"battle-chess/{args.unit}_s{seed}", seed))
        print(f"{args.unit} seed {seed}: {time.time() - started:.1f}s {files}", flush=True)


if __name__ == "__main__":
    main()
