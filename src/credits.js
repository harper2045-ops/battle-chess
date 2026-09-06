/** In-app attribution copy (mirrors key lines from CREDITS.md). */
export const CREDITS_TITLE = 'Credits'

export const CREDITS_SECTIONS = [
  {
    id: 'kings-gambit',
    heading: 'King’s Gambit — Ivory Kingdom 3D pieces',
    body: 'The animated fantasy pieces come from King’s Gambit (medieval 3D chess) by ainan9274. Battle Chess loads the Ivory Kingdom army (king, queen, mage, knight, guardian, footman) under an MIT license.',
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
    body: 'Earlier builds used the CC0 Quaternius RPG Character Pack. Those files may still be present for reference; the live board uses Ivory Kingdom assets.',
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
