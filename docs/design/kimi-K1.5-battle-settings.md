# K1.5 — Persisted battle settings

## Built

Added Full / Short / Off battle preferences to the existing settings store and menu, and passed the selection to the board's capture adapter.

## Files

- `src/game/settings.js` — schema, normalization, storage, and reduced-motion default.
- `src/game/settings.test.js` — persistence and reduced-motion coverage.
- `src/App.jsx` — battle state, menu fieldset, persistence, and board prop.

## Interface

```js
readSettings(storage, reducedMotion) // includes battles: 'full' | 'short' | 'off'
```

```jsx
<ChessBoard3D battleMode={battleMode} />
```

## Decisions

- Normal default is Full; a reduced-motion user with no explicit preference defaults to Off.
- An explicitly saved Full or Short choice is preserved even when reduced motion is requested. The board still uses its reduced-motion fallback at playback time.
- Changing modes uses the existing settings storage key and does not reset chess state.
- Off retains the current on-board capture animation rather than disabling capture presentation entirely.

## Untested

Menu interaction and persistence require browser verification alongside real captures. No App changes were made to bot scheduling, reset, undo, or mode-change guards in this step.

## Next

Verify Full, Short, Off, skip, and reset/undo-during-cutaway in a real game, then document the complete K1 theater.
