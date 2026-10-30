# Handoff: Kimi K3.1 Pro

You're picking up the Battle Chess redesign. Your API budget is small, so work on
the hardest code first and **save your work constantly**. Another agent finishes
whatever you don't get to, using your notes.

## Read first (in this order)

1. `AGENTS.md`: project rules. They are binding.
2. `docs/design/2026-10-29-battle-chess-1988-redesign.md`: what we're building and
   why. It is the source of truth. If something you want to do conflicts with it,
   write the conflict in your progress log instead of changing the design.
3. `docs/handoff/kimi-progress.md`: what's done so far. Append to it; never
   rewrite earlier entries.

## What's already in the game (2026-10-30)

- Two generated armies on the board: white = ivory plate and royal blue, black = dark
  steel and crimson. One GLB per unit in `public/models/armies/<color>_<type>.glb`
  (e.g. `w_n.glb`), each with clips `idle`, `attack`, `hit`, `death`, `walk`. Rook
  golems punch instead of swinging a weapon.
- Weapons and shields are separate GLBs in `public/models/armies/props/`, attached to
  hand bones at load by `src/battle/propAttach.js` using `src/battle/loadout.json`.
  Each attached prop is named after its file (`w_spear`, `b_kite_shield`, …), so
  `actor.getObjectByName('w_spear')` finds it.
- `src/battle/units.js` is the unit manifest. `FantasyPiece.jsx` loads from it.
  `MODEL_TURN` (a half-turn) is applied under the board's yaw because these models'
  front is the opposite side from the old Ivory ones; keep it in anything new that
  places a unit, or units will face away from each other.
- Unit heights on the board come from `TARGET_HEIGHT` in
  `src/components/ivoryNormalize.js` (1 unit = 1 square).
- Run the game with `npm run dev` (port 5173). Against the bot is the quickest way
  to get captures.

## Save-your-work rules (most important)

Your credits can run out at any moment. Assume every turn could be your last.

- **Branch:** `kimi/battle-theater`, created from `design/battle-chess-1988`.
  If it already exists, check it out and continue.
- **Commit after every small working step.** Don't batch. Before each commit run
  `npm run lint && npm run build && npm run test`. If a step is half-done and
  tests fail, commit it anyway with `WIP:` at the start of the message, and say
  exactly what's broken in the progress log.
- **Push after every commit:** `git push -u origin kimi/battle-theater`.
- **Every turn**, before you stop, append an entry to
  `docs/handoff/kimi-progress.md` (template inside) and commit + push it.
- **When you finish a task**, write `docs/design/kimi-<task-id>-<short-name>.md`
  saying what you built, the files, the interface, decisions you made, what's
  untested, and what's next. Commit + push.
- Stage only files you changed (`git add <paths>`). Never `git add -A` or
  `git add .`. Never force-push, rebase pushed commits or delete branches.
- End every commit message with `Co-Authored-By: Kimi K3.1 Pro`.
- Don't install new npm packages without writing why in the progress log.
  `@react-three/postprocessing` is pre-approved if you need it for the cutaway look.

## Hard rules for the code

- `chess.js` owns chess state. Presentation must never decide a chess outcome.
- Keep Human vs Human, Human vs Bot, and Easy / Medium / Hard working.
- Keep the stale-bot-response guards (reset, undo and mode change must cancel an
  in-flight bot move). Test this by hand after any change to `App.jsx`.
- The `activeCapture` → `onCaptureComplete` handshake must call complete **exactly
  once**, including when the battle is skipped or the component unmounts
  (reset/undo mid-battle). Missing it freezes the game; calling it twice corrupts
  turn flow.
- Add Vitest tests for every new pure function.

## Tasks, hardest first. Do them in order.

### K1: Battle theater (the core of the redesign)

Build the deep module described under "New deep module: the battle theater" in the
design doc.

1. `src/battle/planBattle.js`: pure `planBattle(event, { mode, seed })` →
   `BattleScript`. Generic attack → hit → death for any pair, plus a matchup
   override table with at least 4 signature fights (queen spell, rook golem smash,
   knight charge, pawn vs pawn spear duel). Modes: `full` (about 3–6 s) and
   `short` (about 1.5–2.5 s).
   Tests in `src/battle/planBattle.test.js`:
   - all 36 type pairs × both colours produce a valid script
   - beats are sorted, and none fall outside the duration
   - the defender always ends dead
   - en passant and promotion captures work
   - the same seed gives the same script
2. ~~`src/battle/units.js`~~ **Done by Claude (2026-10-30).** `units.js` is the
   unit manifest: one GLB per unit in `public/models/armies/` with clips `idle`,
   `attack`, `hit`, `death`, `walk`, plus weapon/shield props attached to hand bones
   at load (`src/battle/propAttach.js`, data in `src/battle/loadout.json`).
   `FantasyPiece.jsx` already reads from it. In the theater, use the same loader;
   to drop a weapon, find the prop by name under the actor (e.g. `w_spear`) and
   hide it.
3. `src/components/BattleTheater.jsx`: plays a `BattleScript` inside the existing
   `<Canvas>`:
   - Show a simple arena: floor plane, dim fog, one key light and one rim light.
     It's a placeholder set; keep it cheap.
   - Place the two actors facing each other.
   - Drive their animation clips from the beats.
   - Move a cinematic camera through the named shots (`wide-two-shot`,
     `close-attacker`, `close-defender`, `low-hero`, `fade-out`). Ease between
     shots; no jump cuts except on purpose.
   - Letterbox bars and a quick fade to black between board and arena (in and out).
   - Skip on click, Space or Esc.
   - Call `onComplete` exactly once. Put the play / skip / unmount / complete logic
     in a small pure state machine (`src/battle/theaterController.js`) and test that
     every path completes exactly once; the component only drives it.
4. Wire it in `ChessBoard3D.jsx`: when `activeCapture` is set and the battle setting
   isn't Off, render `BattleTheater` instead of the board, then show the board again
   with the attacker already on the target square. Keep the existing
   `CaptureActors` as the reduced-motion / Off adapter.
5. Battle setting (Full / Short / Off) in `src/game/settings.js` (persisted like the
   others). Default Off when `prefers-reduced-motion` is set.

Done when: every capture in a real game against the bot plays a cutaway and returns
to a correct board; skip works; reset or undo during a cutaway doesn't freeze or
double-move; lint, build and test pass.

Use the real clips: attacker `walk` in, `attack`, defender `hit` then `death`. A
unit's clip lengths are on `gltf.animations[i].duration`; plan beats from a duration
table you pass in (so `planBattle` stays pure and testable), not from hard-coded
guesses.

### K2: Full-screen 1988 board

1. The play screen is only the canvas, 100vw × 100vh, no frame, border or panels.
   Remove from the play screen (don't delete the components): `game-status`
   heading, `BotThinking`, `MatchAlertBanner`, `BattleBanner`, `ChessClocks`,
   `CapturedPieces`, `match-details`.
2. One small corner menu button that fades to low opacity after 2 s without mouse
   movement. It is the only HTML over the board.
3. Fixed 1988-style camera (see design doc → Play-screen layout). Remove any
   zoom/orbit/pan. Fit the board to the viewport by aspect ratio. Add tests for the
   camera-fit math.
4. Check: the checked king's square glows red on the board. Game over: end card
   (Rematch / Menu) after the final battle. A visually hidden `aria-live` region
   announces check, mate and captures.
5. Hide the time-control picker in the menu and default to Untimed (keep the clock
   code).
6. Background: dark, quiet, nothing that competes with the board.

Done when: at 1440×900 and 1920×1080 the board fills the screen with no scrollbars
and no visible UI except the faded menu button; everything in K1 still works.

### K3: Sound hookup (only if K1 and K2 are done)

`src/battle/sounds.js`: a manifest mapping sound names (from `BattleScript` beats)
to files in `public/audio/`. Play beat sounds in `BattleTheater` and the music bed
on the board, through the existing mute toggle in `src/game/sound.js`. Audio files
may not exist yet: missing files must fail silently, so log once and keep playing.

### K4: Special moments (check, mate, castling, promotion)

Pure planning first, then presentation. Extend `planBattle` or add
`src/battle/planMoment.js` with tests.

1. **Check:** the checked king plays `hit` on the board (a flinch) and its square
   glows red (the glow may already come from K2).
2. **Checkmate:** the last capture or the mating move gets a longer, slower cutaway
   that ends on the losing king's `death`, then the end card.
3. **Castling:** king and rook both `walk` to their squares at the same time on the
   board (today only one piece animates).
4. **Promotion:** the pawn flashes and is replaced by the new unit, which plays a short
   `attack` flourish in place. Works for promotion with and without a capture.

Done when: each moment has tests for its plan and plays in a real game, and none of
them can change what chess.js decides.

### K5: Weapons in battle

1. When a defender dies in a cutaway, its weapon falls: detach the prop from the hand
   bone into the arena at its current world transform, then tumble it to the floor
   with a simple scripted arc and spin (no physics library). Put the arc in a pure
   function with tests (lands on the floor, settles, deterministic for a seed).
2. A defender with a shield (pawns, knights) raises it on `hit`: keep this cheap, e.g.
   a short rotation of the shield prop, not a new animation.
3. Props must be restored (or the actor recreated) when the board comes back, so the
   unit isn't missing its weapon on the next battle. Test this.

### K6: Keyboard play on the board

AGENTS.md asks for keyboard play where practical, and it also makes the game testable
without a mouse.

1. `src/game/boardCursor.js` (pure, tested): a cursor square moved with the arrow keys,
   flipped correctly when the board is viewed from black.
2. Enter or Space selects the piece under the cursor, then moves it to the cursor
   square if legal; Esc cancels. Legal-move highlighting stays the same as mouse play.
3. The cursor square is drawn on the board (a thin outline), and the visually hidden
   `aria-live` region announces the square and piece.
4. Keyboard input is ignored while a cutaway is playing, except Space / Esc to skip.

### K7: Performance pass (60 fps target)

32 skinned units of about 40k triangles each, plus props.

1. Add a dev-only frame-time readout behind a URL flag (`?fps`), off by default and
   never shown to players.
2. Measure at 1920×1080 on the board and in a cutaway; write the numbers in your task
   doc.
3. If under 60 fps, fix the cheapest things first: pause or slow idle mixers for
   pieces that aren't moving (there's already a half-rate idle tick in
   `FantasyPiece.jsx`), share materials between pieces of the same unit, make sure
   theater actors and their clones are disposed when a cutaway ends. Don't lower the
   look of the units without writing down why.
4. Check memory doesn't grow across 20 captures (dev tools heap snapshot, or
   `renderer.info` before and after); fix leaks you find.

### K8: Arena sets for the cutaways

Replace K1's placeholder arena with 3 cheap sets built from three.js primitives and
lighting: castle courtyard, stone bridge, throne room (for king deaths). `planBattle`
picks the set (pure and deterministic, tested); fog and lighting keep the background
quiet and the fighters readable. Stay within K7's frame budget.

## Not your job (skip these)

Generating or editing 3D models, rigging, moves, music, voices or SFX, and anything
under `scripts/assets/`. Those run on local models on the user's Mac and are done
separately. If you need a move or prop that doesn't exist, write it in the progress
log under "Asset requests" and work around it. Use the generated armies in `public/models/armies/` (via `src/battle/units.js`) and silence.

## If you get stuck

Write what you tried and what blocked you in the progress log, commit, push, and
move on to the next sub-step you *can* do.
