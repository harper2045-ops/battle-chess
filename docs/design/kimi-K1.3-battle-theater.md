# K1.3 — Battle theater and lifecycle

## Built

A Three.js cutaway adapter for `BattleScript`, plus a pure exactly-once playback controller and shared unit-loading hook.

## Files

- `src/components/BattleTheater.jsx` — courtyard floor/fog/lights, two armed actors, clip playback, approach movement, eased named camera shots, letterbox, fades, and click/Space/Escape skip.
- `src/battle/theaterController.js` — play, skip, natural completion, unmount, and Strict Mode-remount lifecycle.
- `src/battle/theaterController.test.js` — exactly-once coverage for every lifecycle path.
- `src/battle/useUnit.js` — shared `useGLTF` unit/prop loader used by board and theater.
- `src/components/FantasyPiece.jsx` — consumes the shared loader; board behavior unchanged.
- `src/index.css` — theater letterbox, fade, skip affordance, and keyboard focus style.

## Interface

```jsx
<BattleTheater script={battleScript} onComplete={() => {}} />
```

The component uses the real clips returned by `useUnit`: attacker `walk` → `attack`; defender `idle` → `hit` → `death`. `MODEL_TURN` remains applied below each actor's arena facing rotation.

## Decisions

- Real unmount completion is deferred by one microtask. A synchronous remount cancels it, preventing React Strict Mode's setup/cleanup simulation from skipping battles.
- Skip and natural completion are immediate; all later paths become no-ops after the first completion.
- Arena geometry and lighting are deliberately cheap placeholders for K8.
- No sound playback is included; K3 owns the beat-sound manifest.

## Untested

The component is build-checked but not yet wired to live captures. Visual camera composition, actual clip timing, and board return behavior require K1.4 browser verification.

## Next

Wire battle settings and capture planning into `ChessBoard3D`, retaining `CaptureActors` as Off/reduced-motion fallback, then test real bot captures and skip/reset/undo behavior.
