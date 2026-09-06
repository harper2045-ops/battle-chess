# King’s Gambit — Ivory Kingdom

Rigged GLB characters and skeletal animation clips for the six chess roles,
sourced from the **Ivory Kingdom** army of
[ainan9274/rork-medieval-3d-chess](https://github.com/ainan9274/rork-medieval-3d-chess)
("King’s Gambit").

## Layout

```
{k,q,b,n,r,p}/
  rigged.glb   # skinned mesh + skeleton (the visual)
  idle.glb     # looping combat stance
  attack.glb   # one-shot strike / cast
  death.glb    # one-shot fall
  walk.glb     # in-place stride (available for march FX)
```

Each animation file carries a single `AnimationClip`. `FantasyPiece.jsx` loads
`rigged.glb` for the mesh, then renames and merges clips from the anim GLBs to
`idle` / `attack` / `death` / `hit` (hit reuses a short slice of idle).

## License

MIT — see the repo-root `CREDITS.md` and the upstream project license.
Models were generated for King’s Gambit and redistributed here under the same
terms as the upstream repository.
