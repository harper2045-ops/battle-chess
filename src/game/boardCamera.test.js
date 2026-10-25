import { describe, expect, it } from 'vitest'
import { getBoardCameraMaxDistance, getBoardCameraPosition } from './boardCamera.js'

describe('getBoardCameraPosition', () => {
  it('keeps the established framing on wide boards', () => {
    expect(getBoardCameraPosition('w', 1.4)).toEqual([0, 8.4, 8.8])
  })

  it('moves back far enough to fit narrow boards', () => {
    expect(getBoardCameraPosition('w', 0.65)).toEqual([0, 16.8, 17.6])
  })

  it('preserves the opposite orientation', () => {
    expect(getBoardCameraPosition('b', 1.4)).toEqual([0, 8.4, -8.8])
  })

  it('keeps orbit controls beyond the fitted camera distance', () => {
    const position = getBoardCameraPosition('w', 0.65)
    const fittedDistance = Math.hypot(...position)
    expect(getBoardCameraMaxDistance('w', 0.65)).toBeGreaterThanOrEqual(fittedDistance)
    expect(getBoardCameraMaxDistance('w', 1.4)).toBe(13)
  })
})
