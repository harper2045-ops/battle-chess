# ⚔️ Battle Chess

Real chess underneath. A cinematic war game on top.

Battle Chess is a full rules-legal chess game rendered on a low-poly 3D
battle board, with animated fantasy armies, capture "battle report" events,
and an optional Stockfish opponent.

## Features

- Human vs Human and Human vs Bot play, with Easy / Medium / Hard Stockfish
  difficulty.
- Legal move generation and game state via [chess.js](https://github.com/jhlywa/chess.js).
- Animated 3D board with King’s Gambit **Ivory Kingdom** fantasy pieces
  (see [`CREDITS.md`](./CREDITS.md)), built with
  [react-three-fiber](https://github.com/pmndrs/react-three-fiber) and
  [drei](https://github.com/pmndrs/drei).
- Structured battle events (captures, check, checkmate) that drive banners
  and capture animations without touching chess logic.
- Chess clocks with multiple time controls (untimed, 1+0, 3+2, 5+0, 10+0).
- Undo / redo, board flip, and PGN copy/download.

## Architecture

- `chess.js` is the single source of truth for chess state and legality.
- Stockfish (`src/engine/stockfishEngine.js`) only selects moves — it never
  owns game state.
- Presentation and animation (`src/components/`) never determine chess
  outcomes; they react to structured events emitted from
  `src/battle/battleEvents.js`.
- Game orchestration lives in small, testable modules under `src/game/`
  (board orientation, clocks, history/undo-redo, PGN export, player turn
  logic) and thin hooks under `src/hooks/`, keeping `App.jsx` focused on
  wiring rather than logic.

See `AGENTS.md` for the full set of project rules for contributors
(human or agent).

## Getting started

```bash
npm install
npm run dev
```

## Regenerate the sci-fi models

The standalone Blender script creates all 32 pieces, 12 modular gameplay GLBs,
and board/full-scene exports without downloaded assets or third-party add-ons.
It replaces the active Blender scene, so save other work first.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/generate_pieces_blender.py
```

Set `SCI_FI_CHESS_OUTPUT` to override the repository/export root. See
[`docs/blender-export-pipeline.md`](./docs/blender-export-pipeline.md) for
Scripting-workspace instructions, exact glTF settings, compression options,
engine integration, and validation commands.

## Scripts

- `npm run dev` — start the Vite dev server.
- `npm run build` — production build.
- `npm run preview` — preview the production build locally.
- `npm run lint` — lint with oxlint.
- `npm run test` — run the test suite with Vitest.

Before finishing any change, run lint, build, and test, and fix any
failures.
