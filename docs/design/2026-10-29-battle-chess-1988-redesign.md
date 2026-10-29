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

**Decision: Pixal3D for all units.** Hunyuan3D 2.1 stays installed as a backup
shape-only generator. Its painting is what loses on this Mac, not its shapes.
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
