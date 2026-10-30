# Battle Chess 1988-style redesign

Status: approved direction (2026-10-29). This doc is the source of truth for the
redesign. Record new decisions here; flag conflicts instead of quietly changing them.

## The goal in one paragraph

The whole screen is the chessboard. No panels, clocks, captured-piece trays,
banners or move lists while you play. The board is seen from a fixed 3/4 angle,
like the 1988 Interplay *Battle Chess*. Pieces are medieval-fantasy soldiers that
walk to their squares. When one piece captures another, the game **cuts away to a
short cinematic fight** between the two units (2–6 seconds), then cuts back to the
board with the result in place. Music and battle sounds play throughout.

Chess rules stay exactly as they are: `chess.js` owns state and legality,
Stockfish only picks moves, and nothing in presentation can change an outcome.

## Decisions (with the user's answers, 2026-10-29)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Who builds | Kimi K3.1 Pro gets the hardest code tasks first (handoff: `docs/handoff/kimi-k3.1-pro.md`). Claude does asset and audio generation and finishes whatever Kimi doesn't. |
| 2 | Art style | Medieval fantasy. |
| 3 | Battles | 1988-style: a **cutaway** fight scene for every capture, then back to the board. Not an on-board camera push-in. |
| 4 | Models | Generate, rig and animate fully locally on this Mac with open models (see "Asset pipeline"). No Mixamo. The current Ivory Kingdom rigged characters are the placeholder cast until generated ones exist. |
| 5 | Base branch | Build from `main` (animated fantasy characters). The sci-fi static pieces on `polish/touch-mobile-board` are parked, not merged. |
| 6 | Play screen | Board fills the screen edge to edge. No clocks, captured pieces, banners, battle report, "Selected", move history, material bar or bot-thinking card. One small corner menu button that fades when idle. |
| 7 | Camera | One fixed 1988-style 3/4 perspective. No user zoom, orbit or pan. The only camera change is the battle cutaway. Flip board still works (it swaps which side is at the bottom). |
| 8 | Surroundings | Nothing that competes with the board. Dark, quiet background (a soft vignette or a very dim floor), no scenery. Battle cutaways get their own small arena set; that's where the spectacle goes. |
| 9 | Platform | Desktop browser, 60 fps. Mobile is out of scope for now (don't break touch input that already works, but don't design for it). |
| 10 | Audio | Battle sounds and music are in scope, made with the user's local models (see "Audio pipeline"). |

### Things the user didn't decide that this doc decides (flag if wrong)

- **Check, mate and game over without pop-ups.** Check is shown *on the board*: the
  checked king's square glows red. Game over plays a final cutaway (the king falls),
  then fades to a full-screen end card with Rematch / Menu. That end card is the only
  overlay in play.
- **Turn indicator:** none on screen. Against the bot it's obvious. In Human vs Human,
  the side to move gets a faint glow on its back rank edge.
- **Clocks:** the clock code stays (don't delete working systems) but timed games
  move off the play screen. The menu defaults to Untimed and the time-control picker
  is hidden until there's a non-intrusive way to show time. Conflicts with the
  earlier clock work (PRs 1, 17), so this is flagged here.
- **Pawn promotion:** the picker stays but is restyled as four unit portraits over
  the board, then disappears.
- **Battles are real-time 3D in the same Three.js scene, not pre-rendered video.**
  The user described it as a "video type thing"; it will look like one (letterboxed,
  cinematic camera) but it's rendered live so every attacker × defender pair works
  without 36+ video files, and it stays sharp at any screen size.
- **Skippable:** click, Space or Esc skips a cutaway. Settings menu: Battles = Full /
  Short / Off. `prefers-reduced-motion` defaults to Off (falls back to the current
  on-board capture animation).

## Architecture

The chess layer already emits structured events (`src/battle/battleEvents.js`):
`createCaptureEvent(move)` and `createQuietMoveEvent(move)`. `App.jsx` holds
`activeCapture` / `activeMove` and waits for `onCaptureComplete` /
`onMoveComplete` before the next turn. That handshake is the seam, and it stays.

### New deep module: the battle theater

One module owns everything about a cutaway fight. Callers learn two things:

```js
// Pure, testable: what the fight looks like, as data.
planBattle(captureEvent, { mode: 'full' | 'short', seed }) -> BattleScript

// React/Three: plays a script, calls onComplete exactly once (also on skip/unmount).
<BattleTheater script={script} onComplete={fn} />
```

`BattleScript` is plain data:

```js
{
  duration: 4.2,                      // seconds
  arena: 'courtyard',                 // which arena set
  actors: {
    attacker: { type: 'n', color: 'w', mark: 'A' },
    defender: { type: 'b', color: 'b', mark: 'B' },
  },
  beats: [                            // sorted by t; nothing outside duration
    { t: 0.0, shot: 'wide-two-shot' },
    { t: 0.0, actor: 'attacker', clip: 'walk', to: 'engage' },
    { t: 1.1, actor: 'attacker', clip: 'attack' },
    { t: 1.5, sound: 'sword-hit' },
    { t: 1.5, actor: 'defender', clip: 'hit' },
    { t: 2.0, shot: 'close-defender' },
    { t: 2.0, actor: 'defender', clip: 'death' },
    { t: 3.6, shot: 'fade-out' },
  ],
}
```

Why this shape:

- **Depth.** All choreography, camera shots, sound timing and per-matchup flavour
  live behind `planBattle`. The board and `App.jsx` never learn about any of it.
- **Testable without WebGL.** `planBattle` is a pure function. Tests check: every
  pair of the 36 type pairs (×2 colours) gets a valid script; beats are sorted; the
  defender always dies; durations respect the mode; en passant and promotion
  captures work; same seed → same script.
- **Signature fights as data.** A table of matchup overrides (e.g. queen vs anything
  = spell; rook golem = smash; pawn vs pawn = spear duel) keeps the 1988 feeling of
  unique fights without code per pair. Unlisted pairs fall back to generic
  attack → hit → death.
- **Two adapters at the seam, so the seam is real:** `BattleTheater` (cutaway) and
  the existing on-board `CaptureActors` (reduced motion / Battles = Off). The
  current `ChessBoard3D` picks one based on the battle setting.
- **Swappable art.** Clip names (`idle`, `walk`, `attack`, `hit`, `death`, plus
  optional `attack2`, `cast`, `block`) are the contract with the models. New
  generated characters drop in by matching clip names in a unit manifest.

### Unit manifest

`src/battle/units.js` (data only) maps each piece type to its model and clips:

```js
export const UNITS = {
  p: { name: 'Spearman', model: '/models/army/p/rigged.glb',
       clips: { idle: '/models/army/p/idle.glb', attack: '...', death: '...', walk: '...' },
       height: 0.78, sounds: { attack: 'spear-thrust', death: 'grunt-fall' } },
  // n: Knight, b: Bishop (staff + sword), r: Stone golem tower, q: Sorceress, k: Old king
}
```

`FantasyPiece.jsx` reads this instead of hard-coding paths. Team colour stays a
material tint (ivory vs. obsidian) so one model per type serves both sides.

### Play-screen layout

- `<main className="play-screen">` holds the canvas at 100vw × 100vh, no frame or
  border, and one absolutely-positioned corner menu button.
- Everything currently in the play screen except `ChessBoard3D`, `PromotionPicker`
  and the hidden keyboard-shortcut text moves out of it. Components stay in the repo
  (menu can show history/PGN later).
- Camera: the fixed 1988 view (low 3/4 angle from the player's side, around 50–55°
  from horizontal). The board is fitted to the viewport so its corners touch the
  screen edges at 16:9 and 16:10, computed from aspect ratio (extend the existing
  `getBoardCameraPosition`).
- Accessibility: keep the existing hidden square buttons and keyboard input; add
  `aria-live` text for check/mate/captures in a visually hidden element (replaces
  the visible banners for screen readers).

## Asset pipeline (second research sweep, official docs, 2026-10-29)

**Everything runs locally on this Mac. No Mixamo, no cloud services** (user
decision, 2026-10-29). Machine: Apple M5 Max, 64 GB unified memory, 561 GB free,
Xcode and Blender 5.2.1 installed. That is twice the memory AssetFurnace recommends
and well above every model's stated minimum, so use the high-quality settings by
default.

What the official repos say (and why we don't run them directly):

| Model | Job | Official platform | Licence |
|---|---|---|---|
| [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) (`microsoft/TRELLIS.2-4B`) | image → PBR mesh | Linux + NVIDIA 24 GB only | MIT |
| [Hunyuan3D 2.1](https://huggingface.co/tencent/Hunyuan3D-2.1) | image → mesh + PBR paint | NVIDIA; Mac via community forks | Tencent community (fine for the user's country) |
| [SkinTokens](https://github.com/VAST-AI-Research/SkinTokens) (`VAST-AI/SkinTokens`, successor to UniRig) | mesh → skeleton + skin weights | NVIDIA 14 GB (official) | MIT |
| [HY-Motion 1.0](https://huggingface.co/tencent/HY-Motion-1.0) | text → body motion | macOS, Windows, Linux (official) | see repo |
| [UniMate](https://github.com/Friedrich-M/UniMate) | text → motion on *any* rigged GLB | not stated | code MIT, weights CC BY-NC |

The official mesh and rig repos assume NVIDIA. The tool that already ports them to
Apple Silicon and joins them up is
**[AssetFurnace / image-to-3dlab](https://github.com/Bingeljell/image-to-3dlab)**
(Apache-2.0, about 1,000 stars, updated today). Its Mac routes:

- **Pixal3D** (MIT): about 6 min per model on a base M5. Default.
- **TRELLIS.2 Apple Silicon port**: 15–35 min, about 2× faster with the `mlx`
  attention backend. Highest detail; use it for the hero units (king, queen).
- **Hunyuan3D-MLX**: about 9 min.
- **SkinTokens auto-rig** in pure PyTorch, then a bind step in Blender.
- **Built-in motion clips** made with NVIDIA Kimodo, retargeted to the rig.
  They already include the battle basics: `idle`, `walk`, `fight_stance`,
  `sword_swing`, `punch`, `kick`, `hit_react`, `death` (two takes each).
- An MCP server, so Claude can drive it (`claude mcp add assetfurnace -- ~/image-to-3dlab/lab mcp`).

Pipeline per unit:

1. **Concept image**: front-facing A-pose, plain background, medieval fantasy,
   readable silhouette. Generated locally (ComfyUI image models or AssetFurnace's
   Qwen-Image).
2. **Image → mesh** with Pixal3D (TRELLIS.2 for king and queen).
3. **Auto-rig** with SkinTokens, then apply the AssetFurnace clips.
4. **Extra moves the presets lack** (spear thrust, spell cast, golem smash, king
   falling): generate with **HY-Motion 1.0** (officially supports macOS; the 26 GB
   model fits easily) and retarget in Blender. UniMate is the backup if HY-Motion's
   output is hard to retarget.
5. **Blender cleanup** (scripted, headless): decimate to about 20–40k triangles per
   unit, scale to 1 board square = 1 unit, origin at the feet, and export each clip as
   its own GLB to match the existing Ivory Kingdom layout. Then run `gltfpack` for
   smaller files.

### First test unit (2026-10-29)

- Installed: AssetFurnace v0.5.3 in `~/image-to-3dlab` with Pixal3D (built with
  Metal; needed `brew install ninja`) and SkinTokens auto-rig.
- Concept: `scripts/assets/concept_images.py` (Qwen-Image 2.1 + Lightning in the
  local ComfyUI, about 10 s per image). Pawn spearman, seed 4.
- Pixal3D: picture → model → 40k-triangle finish → skeleton (27 bones) →
  `sword_swing`, **3 min 40 s in total** on the M5 Max. Output 9 MB GLB with 2048²
  textures. The model itself looks excellent from all four sides.
- **Problem found:** held items get skinned to the body, so the spear bends like rubber
  and the shield crumples when the unit moves.
  **Decision:** generate units **empty-handed**. Generate weapons and shields as
  separate props (AssetFurnace prop mode), then attach them rigidly to the hand bones
  in Three.js. This is standard game practice, and it lets the battle theater swap or
  drop weapons.
### Pixal3D vs Hunyuan3D 2.1 (same picture, 2026-10-29)

Hunyuan3D 2.1 was installed through the Mac port in `~/hunyuan3d-2.1-mac` and run
with `scripts/assets/hunyuan21_generate.py` (50 steps, octree 384). Both were rendered
with `scripts/assets/render_compare.py`, using the same angles and lights. The sheet is
`docs/design/pawn-pixal3d-vs-hunyuan21.png`.

| | Pixal3D | Hunyuan3D 2.1 |
|---|---|---|
| Time | 3 min 40 s (includes clean-up, rig and a move) | 2 min 48 s (shape 2:15, paint 0:32) |
| Shape | crisp face, spear tip, armour edges | clean and solid but softer; blobby spear tip, flatter face |
| Paint | matches the picture closely on all sides | muddy and wrong colours; the Mac port only allows its lowest paint setting (6 views at 256 px), because the higher ones need flash attention, which Macs don't have |
| Problems | none besides the held-item rigging issue above | its GLB export scrambles the paint (the OBJ copy is fine); stray floating specks |

#### Second try: Hunyuan3D 2.1 at the official settings

The first run used the Mac port's default, which caps painting at 6 views × 256 px. The
port refuses the official settings because Macs have no flash attention, but its own
chunked-attention patch computes the same result exactly in slices.
`scripts/assets/hunyuan21_generate.py` now applies the official app's guidance (7.5),
Tencent's `FloaterRemover` and `DegenerateFaceRemover` clean-up, and the README's paint
setting with that patch allowed.

- **6 views × 512 px (the README setting):** worked. Shape 1:53, paint 1:05, 2:58 in
  total. The paint is clean steel with gold trim and real metallic and roughness maps.
  Sheet: `docs/design/pawn-pixal3d-vs-hunyuan21-official.png`.
- **8 views × 768 px (the official app setting), first attempt:** **kernel-panicked the
  64 GB M5 Max**. Memory compression hit 100% of its segment limit with 87 swap files,
  and the watchdog restarted the machine.
- **Why:** the multiview attention grows with the square of views × patches. 768 px with
  8 views is about 9× the work of 512 px with 6 views, with a 607 GiB full score matrix.
  The port also turns off PyTorch's memory cap (`PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0`),
  so instead of raising an error it pushed macOS into swap until it froze.
- **Fixed, in `hunyuan21_generate.py`:** memory cap back on (70%), a memory watchdog,
  feed-forward chunking (the UNet blocks already support it), and plain sliced attention
  (matmul → softmax → matmul) in place of MPS SDPA. MPS SDPA was holding 21.8 GiB of
  scratch memory outside PyTorch's allocator. The plain version matches PyTorch's own
  attention to within fp16 rounding. Above 6 × 512 these switch on automatically.
- **8 × 768 result:** paint took **10 min 45 s**, the lowest free memory was 14.4 GiB,
  and nothing swapped. It is the best Hunyuan output: visible chainmail, crisp gold trim,
  a sharper face, and a correct blue tabard on the back.
  Sheet: `docs/design/pawn-pixal3d-vs-hunyuan21-768.png` (rows: Pixal3D, Hunyuan 512,
  Hunyuan 768).

Result: Hunyuan at 768 has the richest material detail: real steel, chainmail and
proper PBR maps. Pixal3D is still the closest to the concept picture: ivory rather than
dark steel, and a crisper shield. It's a style choice more than a quality gap now.
Per unit, Pixal3D takes about 4 minutes and Hunyuan 768 about 13 minutes (shape 2 min,
paint 11 min).

#### Faster Hunyuan attention through MLX (built, 2026-10-29)

**Result:** the 8 × 768 paint went from **10 min 45 s to 3 min 55 s (2.7× faster)**.
The lowest free memory rose from 14.4 to 22.8 GiB, with no swap, and the render matches
the plain run. `hunyuan21_generate.py` turns MLX on automatically above 6 × 512 when
`mlx` is installed (it is now: `mlx==0.32.4` in `~/hunyuan3d-2.1-mac/venv`).

Gotcha found on the way: MLX's fused kernel needs equal query/value head dims of 64, 80
or 128, and otherwise *silently* builds the full score matrix. The paint UNet's
reference attention has 64-dim queries and 128-dim values, which cost 19.5 GiB and ran
PyTorch out of memory. The fix splits the value into 64-wide column blocks, which is
exact. Unsupported query dims (the VAE's 512) go to plain sliced attention, and MLX's
cache is cleared after every call.

Original benchmark:

Apple's MLX has a fused, memory-efficient attention kernel
(`mx.fast.scaled_dot_product_attention`), the Mac counterpart of NVIDIA's flash
attention. Benchmark: one attention call with 12 heads × 64 dims, fp16, on the M5 Max.

| Size | Our plain sliced attention (PyTorch) | MLX fused | Copying torch ↔ numpy |
|---|---|---|---|
| 6 × 512 (24,576 tokens) | 0.20 s | 0.03 s | ~0 s |
| 8 × 768 (73,728 tokens) | 2.20 s | 0.30 s (**7.3× faster**) | 0.01 s |

MLX's output matches PyTorch's to within 6e-5. Routing the paint UNet's attention through
MLX (an `F.scaled_dot_product_attention` replacement that hands q/k/v to MLX and back)
should cut the 8 × 768 paint well below its current 10 min 45 s. How much depends on how
much of the run is attention, which hasn't been measured. It needs `pip install mlx` in
`~/hunyuan3d-2.1-mac/venv`.

#### Army split idea

#### Pixal3D at its official settings (2026-10-29)

AssetFurnace ran Pixal3D below the official `TencentARC/Pixal3D` `inference.py` defaults:
**8 sampling steps** (its "auto" fast mode) instead of 12, and **1024** instead of the
official default **1536** cascade. Its texture flow also ran on "auto", which drops to a
512 PBR volume. Same pawn and seed: 12 steps adds chainmail and crisper trim (about +10 s),
and 1536 adds the finest detail (about 4¾ min instead of 2). Guidance stays at
AssetFurnace's 10, not the official 7.5, because 7.5 drops thin parts.

- pixal3d.cpp refused 1536 for single-view (`--sv-image`) only because it hadn't been
  tested (its design note D10); multi-view already runs 1536 through the same cascade.
  The one-line guard is lifted: `scripts/assets/patches/pixal3d-cpp-sv-1536.patch`.
- AssetFurnace now defaults to res 1536, 12 steps and `--tex-res 1024`:
  `scripts/assets/patches/assetfurnace-official-pixal3d.patch`. AssetFurnace's updater
  refuses to run over local edits, so re-apply both patches after an update.
- No MLX bridge is needed here: pixal3d.cpp already runs GGML's Metal flash-attention
  kernel (`kernel_flash_attn_ext_bf16`) for its big flows.

#### Building the 12 units (`scripts/assets/build_armies.py`)

Concepts: `concept_images.py` with per-army looks and empty hands (`w_*` ivory/gold/blue,
`b_*` dark steel/bronze/crimson). Picks are in `PICKS`. Results (AssetFurnace asset ids)
are in `scripts/assets/armies.json`.

- White army: about 6½–8 min per unit (39k triangles, 34 bones, 2048 textures).
- **Rook golem rig failed:** the model is excellent, but SkinTokens fitted 43 bones and the
  idle folds it up, with its arms through its legs. Retry the rig only.
- **King:** good overall, but the cloak edge near the right elbow stretches into a spike
  (skin weights). Fix with the golem.
- Black army: about 6½–7½ min per unit.
- **All 12 built and rigged (2026-10-30).** Finals (`{unit}_rigged.glb`, `{unit}_idle.glb`,
  8–11 MB each) are in `~/image-to-3dlab/output/armies-final/`. Lineups:
  `docs/design/army-white-lineup.png`, `docs/design/army-black-lineup.png`.
- **Re-rigging:** `scripts/assets/rerig.py` re-rolls SkinTokens with AssetFurnace's own
  rig, check and retarget steps until the skeleton is humanoid with at most 34 bones
  (extra bones meant a broken rig; fewer were fine). It fixed the white golem (34),
  black golem (28, idles and walks cleanly) and white king (34, the arm and cloak spikes
  are gone). The black king's floor-length cloak hid his legs: 1 of 6 tries passed, with
  37 bones, which idles cleanly and walks without tearing the cloak (accepted).
- **Black queen:** two Hunyuan seeds fused a floor slab out of her pooled train. Fixed at
  the concept stage: the queen prompt now asks for a mid-calf cloak with feet visible
  (concept seed 12). Lesson: **no trailing cloth touching the ground in concepts for
  Hunyuan.**
- Known small issues: the black army's faces render orange-tan, the black knight's plume
  is stringy, the black pawn's tabard has two small dark holes, and the white queen leans
  a little in her idle. None of these matter at board scale; revisit for close-up battle
  shots.
- Next: compress for the web (gltfpack / texture compression; currently about 120 MB for
  12 idle GLBs), then attach separate weapon and shield props to the hand bones.

**Decision (user, 2026-10-29): split the armies.**

- **White / ivory army: Pixal3D** (about 4 min per unit, including the rig and a move).
  It's closest to the painted ivory concept.
- **Black army: Hunyuan3D 2.1 at 8 views × 768 px with MLX attention** (about 6 min per
  unit: shape 2 min, paint 4 min). Its darker, real-metal look suits a steel/obsidian
  side. Concept pictures for this army should ask for dark steel, not ivory.
- Both armies go through the same AssetFurnace rig and moves (`create` with
  `model_path` takes any GLB), so animations match across sides.
- All units are generated empty-handed, with weapons and shields as separate props
  (see "First test unit").
5. **Arena sets** for cutaways: 1–3 small sets (castle courtyard, stone bridge,
   throne room for king deaths). Build in Blender from a few generated props, or a
   single generated panorama behind a simple floor. Not decided; keep it cheap.

Until generated units exist, the Ivory Kingdom models on `main` are the cast.

## Audio pipeline (from the user's local setup)

- **Music: YuE2-3B in ComfyUI** (`~/ComfyUI`, checkpoint
  `checkpoints/yue2_3b_bf16.safetensors`, start ComfyUI with `--gpu-only`; runner
  template `~/hypit-ai/studio-project/productions/jaguar/music_test/run_comfy.py`).
  For beds, put "English" and "instrumental, no vocals" in the style or it sings.
  Tracks: menu theme, quiet in-game bed (must not distract), short battle stinger
  loop, victory, defeat.
- **Voices: Fish Audio Drama 3** (`~/drama3-mlx`, 4-bit, temperature 1.1,
  top_p 0.9) for short battle cries, death grunts and a few king lines. Don't run it
  at the same time as other big models.
- **SFX:** Stable Audio 3 (`~/stable-audio-3/src/.venv`) for quick effects: sword
  clash, spear thrust, stone smash, spell, body fall, footsteps.
- Delivered as `.ogg` in `public/audio/` with a small `src/battle/sounds.js` manifest
  keyed by the `sound` names used in `BattleScript` beats. Volume and mute go through
  the existing `src/game/sound.js` mute toggle.

## Out of scope

Mobile layout, online play, new chess rules, replacing Stockfish, cloud rendering.
