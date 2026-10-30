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
   - Call `onComplete` exactly once.
4. Wire it in `ChessBoard3D.jsx`: when `activeCapture` is set and the battle setting
   isn't Off, render `BattleTheater` instead of the board, then show the board again
   with the attacker already on the target square. Keep the existing
   `CaptureActors` as the reduced-motion / Off adapter.
5. Battle setting (Full / Short / Off) in `src/game/settings.js` (persisted like the
   others). Default Off when `prefers-reduced-motion` is set.

Done when: every capture in a real game against the bot plays a cutaway and returns
to a correct board; skip works; reset or undo during a cutaway doesn't freeze or
double-move; lint, build and test pass.

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

## Not your job (skip these)

Generating 3D models, rigging, music, voices or SFX. Those run on local models and
are being done separately. Use the generated armies in `public/models/armies/` (via `src/battle/units.js`) and silence.

## If you get stuck

Write what you tried and what blocked you in the progress log, commit, push, and
move on to the next sub-step you *can* do.
