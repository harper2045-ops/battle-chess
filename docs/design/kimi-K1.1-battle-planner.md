# K1.1 — Pure battle planner

## Built

`planBattle(event, { mode, seed, clipDurations })` returns a deterministic `BattleScript` for full and short cutaways. It supports generic attack → hit → death choreography plus queen spell, rook golem smash, knight charge, and pawn spear-duel signature matchups.

## Files

- `src/battle/planBattle.js` — pure choreography implementation.
- `src/battle/planBattle.test.js` — 72 color/type pairs in each mode, beat bounds/order, defender death, en passant, promotion, signature fights, determinism, and measured-duration coverage.

## Interface

```js
planBattle(captureEvent, {
  mode: 'full' | 'short',
  seed: string | number,
  clipDurations: {
    w_p: { walk: 1.2, attack: 1.0, hit: 0.6, death: 1.8 },
    // ...all units used by the two actors
  },
}) -> BattleScript
```

The script contains `duration`, `arena`, `matchup`, marked `actors`, copied `capture` metadata, and sorted `beats`. Missing or non-positive required clip durations throw an error rather than silently using guessed lengths.

## Decisions

- Promotion changes the attacking actor before signature selection, so a pawn promoting to queen uses the queen spell matchup.
- Full scripts clamp to 3–6 seconds and short scripts to 1.5–2.5 seconds.
- Seed changes only timing jitter; geometry, model loading, and playback remain outside this pure module.
- The courtyard name is retained for K1's cheap placeholder arena; richer sets remain K8.

## Untested

Real GLB clip playback, camera rendering, input skipping, and completion behavior belong to K1.3/K1.4 and are not covered here.

## Next

Build and test the pure theater controller, then play these scripts with measured clip durations from the existing unit loader.
