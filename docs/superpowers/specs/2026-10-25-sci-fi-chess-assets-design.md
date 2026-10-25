# Sci-fi chess asset pipeline design

## Intent

Replace Battle Chess's current static ivory gameplay models with an original procedural sci-fi set while preserving chess legality, game state, modes, and battle-event behavior. Provide a standalone Blender generator and an exact real-time export guide.

## Goals

- Generate an 8x8 board, all 32 pieces in their initial positions, six reusable piece types in two team colors, and a separate modular board.
- Use low-to-mid-poly geometric silhouettes, small applied bevels, flat/controlled smooth shading, and a UV map on every exported mesh.
- Use portable Principled BSDF materials: gunmetal/titanium bodies, dark glass-like panels where useful, Neon Blue white-team emission, and Cyber Orange black-team emission.
- Export 12 gameplay GLBs to `public/models/kings-gambit-ivory/<type>/<color>.glb`, `public/models/sci-fi/board.glb`, and `public/models/sci-fi/full-set.glb`.
- Keep each gameplay piece at its final world-unit height, with its origin at the center of its base, so the renderer no longer needs per-type scale correction.
- Document exact Blender export settings and optional Draco, Meshopt, and texture compression steps without making those tools a requirement for scene generation.

## Non-goals and anti-goals

- Do not change chess state, Stockfish, clocks, move history, or capture event generation.
- Do not add skeletal animation or replace the existing transform-based battle animation system.
- Do not make network access, downloaded assets, third-party Blender add-ons, or a particular absolute repository path necessary to run the generator.
- Do not rely on Blender-only procedural shader graphs, transmission-heavy glass, or compositor bloom for exported material fidelity.
- Do not silently overwrite the user's unrelated uncommitted loader changes.

## Constraints

- Blender 5.2.1 LTS is installed locally and can be used for headless validation; no `blender` executable is on PATH.
- The web stack is Three.js 0.185.1, react-three-fiber 9.7.0, and drei 10.7.8.
- One board square is one world unit. The gameplay tile surface is Y=0.04, matching Blender Z=0.04 before glTF's Z-up to Y-up conversion.
- Gameplay model paths must remain compatible with the current `GeometricPiece.jsx` loader.
- Project verification requires `npm run lint`, `npm run build`, and `npm run test`.

## Approaches

### Chosen: modular procedural meshes

Create reusable mesh-building helpers and six piece-builder functions. Each piece retains separate material regions in a joined mesh with one root object. Export each prototype individually, instance the prototypes for the arranged scene, and export the modular board separately. This fits the current loader and keeps the assets editable.

### Rejected: joined single-material pieces

Joining every surface into one undifferentiated material would simplify objects but sacrifice team accents and editing flexibility. Joining geometry while retaining material slots is useful; collapsing the materials is not.

### Rejected: full-scene-only delivery

A single arranged GLB is useful as a showcase but not as the game's primary asset format because pieces must move independently and promotions must swap models.

## Implementation decisions

- Replace `scripts/generate_pieces_blender.py` rather than add a competing generator.
- Resolve output from `SCI_FI_CHESS_OUTPUT` when set, otherwise from the repository containing the script, with a Blender-text-editor fallback.
- Provide configuration constants for output, bevel width/segments, radial segments, team colors, emission strengths, and optional Draco compression. Default to uncompressed portable GLBs.
- Use mesh primitives and custom lathed/profile geometry with capped, clean topology. Apply transforms and bevels before export. Ensure all mesh objects have UV layers; use primitive UVs where suitable and deterministic smart projection for custom/joined meshes.
- Use only standard glTF material features. Alpha-blended glass is limited to accents; bloom remains a renderer effect, not an exported material property.
- Generate pawns and major pieces at final heights matching the current visual targets: 0.78, 0.98, 1.00, 0.99, 1.00, and 1.12 units for pawn, knight, bishop, rook, queen, and king respectively.
- Keep the current loader and animation structure, removing only obsolete size scaling and updating team accent colors where needed.
- Use `board.glb` for standalone/showcase and other-engine use, not as the interactive web board. Restyle the existing web board's metallic frame and tile materials to match while preserving its dynamic selection, legal-move, last-move, touch-hit, and accessible square controls. This is the builder's integration call, not an additional requested gameplay change.
- Add a step-by-step guide covering regeneration, manual Blender export, validation, Three.js loading/bloom, Unity/Unreal import, and optional compression/decoder requirements.
- Document useful official tools and cite primary-source research in `docs/research/blender-gltf-pipeline.md`.

## Validation

- Run the generator with Blender in background mode against a temporary output directory.
- Validate that all 14 expected GLBs exist, contain geometry/UVs/materials, use the expected material properties, and include 32 pieces in the full scene.
- Reimport exported GLBs in Blender to verify the files are readable and geometry survives export.
- Generate the real public gameplay assets after validation, then run the web app and check loading and gameplay visuals in a browser.
- Run lint, build, and tests; commit only task-owned files and push the current branch to its existing `origin` remote.

## Builder discretion

Exact decorative profiles, mesh segmentation within a modest real-time budget, object/material names, and small accent details may be tuned by the builder without changing the asset contract above.
