# Sci-fi Chess Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and integrate an original sci-fi chess set, with production GLB exports and an exact real-time pipeline guide.

**Architecture:** One standalone Blender script builds reusable, UV-mapped prototypes and exports 12 gameplay pieces, a board, and a full arranged scene. The existing React Three Fiber loader consumes the gameplay GLBs; dynamic board controls and chess/battle state remain unchanged.

**Tech Stack:** Blender 5.2.1 Python API, glTF 2.0/GLB, Three.js 0.185.1, React Three Fiber, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-sci-fi-chess-assets-design.md`

## Global Constraints

- Blender generation requires no third-party add-ons, downloaded assets, network access, or absolute repository path.
- Use standard Principled metallic/roughness/emissive materials; emission strengths above 1 use `KHR_materials_emissive_strength`.
- One square is one world unit; piece origins are at base center and gameplay pieces have final heights 0.78/0.98/1.00/0.99/1.00/1.12 for `p/n/b/r/q/k`.
- Default exports are uncompressed; optional Meshopt/Draco/KTX2 steps must include decoder requirements.
- Preserve the user's existing `GeometricPiece.jsx` loader edits and all chess, bot, clock, and battle-event behavior.
- Finish with `npm run lint`, `npm run build`, and `npm run test`, then commit task-owned files and push the current branch.

## Review Focus

- Running from an unsaved Blender text block: output must resolve to a writable, explicit location rather than fail silently; covered by Task 1 Step 4.
- Full-scene object count and placement: exactly 32 independently named pieces in standard starting positions; covered by Task 1 Step 3.
- Export fidelity: all meshes need UVs/normals, valid materials, base-centered origins, and no cameras/lights; covered by Task 1 Steps 3–4.
- Metallic rendering without an environment map: the browser scene must provide usable reflections rather than near-black metal; covered by Task 3 Step 2.
- Compressed variants without decoders: default assets must load with the existing plain `GLTFLoader`; covered by Tasks 2 Step 1 and 4 Step 1.

---

### Task 1: Standalone Blender generator

**Files:**
- Replace: `scripts/generate_pieces_blender.py`

**Interfaces:**
- Produces: `public/models/kings-gambit-ivory/{p,n,b,r,q,k}/{w,b}.glb`, `public/models/sci-fi/board.glb`, and `public/models/sci-fi/full-set.glb`.
- Consumes: optional `SCI_FI_CHESS_OUTPUT` as the repository root override; otherwise auto-detect the repository from `__file__`, with the current Blender file's directory or a documented fallback for unsaved text blocks.

- [ ] **Step 1: Implement configuration, materials, and mesh helpers**
  Define final piece heights, Neon Blue/Cyber Orange accents, emission strengths, radial/bevel budgets, output resolution, reusable Principled materials, transform application, bevel application, UV creation, lathed profiles, boxes, cylinders, and ring accents. Each prototype is one joined mesh with material slots and a base-centered origin.

- [ ] **Step 2: Implement six silhouettes, board, exports, and full scene**
  Build distinctive pawn, knight, bishop, rook, queen, and king meshes. Export with `GLB`, `use_selection=True`, `export_apply=True`, `export_yup=True`, `export_materials='EXPORT'`, `export_image_format='AUTO'`, `export_keep_originals=False`, UVs/normals enabled, tangents/vertex colors/animations/skins/morphs/cameras/lights disabled, and both mesh-compression flags controlled independently (default false). Instance all 32 pieces at standard starting squares on the 8x8 board.

- [ ] **Step 3: Run Blender generation and inspect exports**
  Run: `SCI_FI_CHESS_OUTPUT=/tmp/battle-chess-sci-fi /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/generate_pieces_blender.py`
  Expected: 14 GLBs, no Python errors, 32 full-scene piece objects, every mesh UV-mapped, all expected material factors and dimensions present.

- [ ] **Step 4: Reimport and test portable output resolution**
  Reimport all 14 GLBs in a fresh Blender process and verify nonempty geometry. Run once from an unsaved-text-equivalent working directory with `SCI_FI_CHESS_OUTPUT` set and confirm outputs go only to that override.

### Task 2: Export pipeline guide

**Files:**
- Create: `docs/blender-export-pipeline.md`
- Reference: `docs/research/blender-gltf-pipeline.md`

**Interfaces:**
- Produces: operator instructions and copyable export/compression settings matching Task 1 exactly.

- [ ] **Step 1: Document generation and precise manual export**
  Include Scripting-workspace execution, output override, selection rules, transform/UV/material settings, uncompressed baseline, and exact Draco level 6 with position 14, normal 10, UV 12, color 10, generic 12; Meshopt `EXT_meshopt_compression`; and mutually exclusive mesh codecs.

- [ ] **Step 2: Document engine integration and optimization**
  Include Three.js `GLTFLoader`, environment lighting, emissive-versus-bloom behavior, optional Draco/Meshopt/KTX2 decoder setup, Unity glTF import requirement, Unreal glTF import/version considerations, validation, and mobile performance checks. Cite official primary sources; no generic advice.

### Task 3: Sci-fi web rendering integration

**Files:**
- Modify: `src/components/GeometricPiece.jsx`
- Modify: `src/components/ChessBoard3D.jsx`
- Modify: `src/game/lastMove.js`
- Test: `src/game/lastMove.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: final-size gameplay GLBs from Task 1.
- Produces: `PIECE_HEIGHTS`-free model rendering, blue/orange selection accents, sci-fi metallic board materials, and preserved dynamic square colors/hit areas.

- [ ] **Step 1: Update board-color tests to fail for the new palette**
  Change expected default dark/light squares to the selected cool metallic palette and retain explicit selected/legal/last-move expectations. Run `npm run test -- src/game/lastMove.test.js` and confirm only old-color assertions fail.

- [ ] **Step 2: Implement runtime materials and model scale**
  Remove per-type scale correction, preserve the existing manual model cache/loader and animation logic, update team ring colors, add a lightweight procedural environment for metallic reflections, and restyle frame/tiles without changing board coordinates or interaction meshes. Respect existing reduced-motion behavior and avoid a mandatory bloom dependency.

- [ ] **Step 3: Run focused tests and document regeneration**
  Run `npm run test -- src/game/lastMove.test.js`; expected PASS. Add README commands for Blender generation, optional output override, and the export guide.

### Task 4: Production assets and end-to-end verification

**Files:**
- Generate: the 14 GLBs listed in Task 1 under `public/models/`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: the active sci-fi gameplay set and verified production build.

- [ ] **Step 1: Generate and structurally validate real assets**
  Run the generator against the repository and inspect/reimport the real GLBs. Confirm uncompressed buffers, 12 gameplay models, 32 full-scene pieces, UVs, normals, material factors, and final dimensions.

- [ ] **Step 2: Exercise the game in a browser**
  Start Vite, open the game in the built-in browser, confirm all initial piece types/colors render without loader errors, make a legal move, and check selection/legal-move visuals and board framing on desktop and a mobile viewport.

- [ ] **Step 3: Run project checks**
  Run `npm run lint`, `npm run build`, and `npm run test`; all must pass. Review `git diff` and generated asset sizes for accidental or unrelated changes.

- [ ] **Step 4: Commit and push**
  Stage only task-owned source, documentation, and generated GLBs; do not stage the user's pre-existing `GeometricPiece.jsx` changes separately from the intentionally integrated final file. Commit `feat: add procedural sci-fi chess assets` and push the current branch to `origin`.
