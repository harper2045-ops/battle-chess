# Credits

## The two armies — made for Battle Chess

The units under `public/models/armies/` (ivory army, dark-steel army, their
weapons and shields, and their moves) were generated for this game on a local
Mac through AssetFurnace:

- Pictures: Qwen-Image 2.1 in ComfyUI
- White army 3D: [TencentARC/Pixal3D](https://github.com/TencentARC/Pixal3D)
- Black army and all weapons 3D: [Tencent Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)
  (Tencent Hunyuan 3D 2.1 Community License)
- Skeletons: SkinTokens; moves: Kimodo presets

How they were made: `docs/design/2026-10-29-battle-chess-1988-redesign.md` and
`scripts/assets/`.

## King’s Gambit — Ivory Kingdom 3D pieces

The animated fantasy pieces under `public/models/kings-gambit-ivory/` come from
**King’s Gambit** (medieval 3D chess) by [ainan9274](https://github.com/ainan9274):

- Repository: [ainan9274/rork-medieval-3d-chess](https://github.com/ainan9274/rork-medieval-3d-chess)
- Army: Ivory Kingdom (king, queen, mage, knight, guardian, footman)
- License: **MIT** (see the upstream repository)

Earlier builds loaded the rigged GLBs and separate animation GLBs locally; clip
binding follows the same approach documented in the upstream README
(`rigged` mesh + renamed clips from per-anim GLBs).

## Previously used — Quaternius RPG Character Pack

Earlier builds used the CC0 Quaternius RPG Character Pack under
`public/models/quaternius/`. Those files may still be present for reference;
the live board now uses the generated armies above.
