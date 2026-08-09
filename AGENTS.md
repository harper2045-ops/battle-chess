# Battle Chess — Codex Project Rules

## Product principle

Real chess underneath. A cinematic war game on top.

## Architecture rules

- `chess.js` is the authoritative source of chess state and legality.
- Stockfish only chooses moves; it does not own game state.
- Presentation and animation must never determine chess outcomes.
- Keep chess state separate from presentation state.
- Prefer small modules/components over growing `App.jsx`.
- Design battle events so CSS effects can later be replaced by 3D animation without rewriting chess logic.

## Stability rules

- Preserve Human vs Human.
- Preserve Human vs Bot.
- Preserve Easy / Medium / Hard Stockfish difficulty.
- Prevent stale bot responses after reset, undo, or mode changes.
- Do not rewrite working systems unless there is a clear architectural reason.

## Development rules

- Make focused changes.
- Add tests for new game logic.
- Before finishing a task, run:
  - `npm run lint`
  - `npm run build`
  - `npm run test`
- Fix failures before reporting completion.

## UX rules

- Keep the game responsive on desktop and mobile.
- Support keyboard accessibility where practical.
- Respect reduced-motion preferences.
- Prefer clear game feedback over decorative complexity.

## Battle system direction

Use structured events for captures and other major moments.

Example:

```js
{
  type: 'capture',
  attacker: { type: 'n', color: 'w' },
  defender: { type: 'b', color: 'b' },
  from: 'f3',
  to: 'e5'
}
```
