import { describe, expect, it } from 'vitest'
import {
  CREDITS_SECTIONS,
  CREDITS_TITLE,
  getRequiredAttributionLines,
} from './credits.js'

describe('in-app credits content', () => {
  it('exposes a credits title for the UI control', () => {
    expect(CREDITS_TITLE).toBe('Credits')
  })

  it('includes King’s Gambit Ivory Kingdom MIT attribution', () => {
    const kings = CREDITS_SECTIONS.find((s) => s.id === 'kings-gambit')
    expect(kings).toBeTruthy()
    expect(kings.license).toBe('MIT')
    expect(kings.heading).toMatch(/Ivory Kingdom/i)
    expect(kings.body).toMatch(/ainan9274/)
    expect(kings.links[0].href).toBe(
      'https://github.com/ainan9274/rork-medieval-3d-chess',
    )
  })

  it('lists required attribution lines without fetching CREDITS.md', () => {
    const lines = getRequiredAttributionLines().join('\n')
    expect(lines).toMatch(/King’s Gambit|King's Gambit/)
    expect(lines).toMatch(/MIT/)
    expect(lines).toMatch(/ainan9274\/rork-medieval-3d-chess/)
    expect(lines).toMatch(/Quaternius/)
  })
})
