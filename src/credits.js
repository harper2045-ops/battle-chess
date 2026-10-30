/** In-app attribution copy (mirrors key lines from CREDITS.md). */
export const CREDITS_TITLE = 'Credits'

export const CREDITS_SECTIONS = [
  {
    id: 'generated-armies',
    heading: 'The two armies — made for Battle Chess',
    body: 'The ivory and dark-steel armies, their weapons and their moves were generated for this game on a local Mac: pictures with Qwen-Image, 3D models with Pixal3D (white army) and Tencent Hunyuan3D 2.1 (black army and all weapons), skeletons with SkinTokens and moves with Kimodo, through AssetFurnace.',
    links: [
      {
        label: 'Tencent Hunyuan3D 2.1',
        href: 'https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1',
      },
      {
        label: 'TencentARC/Pixal3D',
        href: 'https://github.com/TencentARC/Pixal3D',
      },
    ],
    license: 'Hunyuan3D 2.1 output: Tencent Hunyuan 3D 2.1 Community License',
  },
  {
    id: 'kings-gambit',
    heading: 'King’s Gambit — Ivory Kingdom 3D pieces',
    body: 'The animated fantasy pieces come from King’s Gambit (medieval 3D chess) by ainan9274. Earlier builds loaded the Ivory Kingdom army (king, queen, mage, knight, guardian, footman) under an MIT license; the files stay in the project for reference.',
    links: [
      {
        label: 'ainan9274/rork-medieval-3d-chess',
        href: 'https://github.com/ainan9274/rork-medieval-3d-chess',
      },
    ],
    license: 'MIT',
  },
  {
    id: 'quaternius',
    heading: 'Previously used — Quaternius RPG Character Pack',
    body: 'Earlier builds used the CC0 Quaternius RPG Character Pack. Those files may still be present for reference; the live board uses the generated armies.',
    links: [],
    license: 'CC0',
  },
]

export function getRequiredAttributionLines() {
  return CREDITS_SECTIONS.flatMap((section) => {
    const lines = [section.heading, section.body]
    if (section.license) lines.push(`License: ${section.license}`)
    for (const link of section.links) {
      lines.push(`${link.label}: ${link.href}`)
    }
    return lines
  })
}
