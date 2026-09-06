import { describe, expect, it } from 'vitest'
import {
  ORBIT_TOUCH,
  SQUARE_HIT_HEIGHT,
  SQUARE_HIT_HEIGHT_COARSE,
  detectCoarsePointer,
  getOrbitTouches,
  getSquareHitHeight,
  prefersCoarsePointer,
} from './boardInput.js'

describe('prefersCoarsePointer', () => {
  it('accepts an explicit boolean', () => {
    expect(prefersCoarsePointer(true)).toBe(true)
    expect(prefersCoarsePointer(false)).toBe(false)
  })

  it('reads MediaQueryList.matches', () => {
    expect(prefersCoarsePointer({ matches: true })).toBe(true)
    expect(prefersCoarsePointer({ matches: false })).toBe(false)
  })

  it('invokes a matchMedia-style function', () => {
    expect(
      prefersCoarsePointer((query) => {
        expect(query).toBe('(pointer: coarse)')
        return { matches: true }
      }),
    ).toBe(true)
  })

  it('treats missing / invalid sources as fine pointer', () => {
    expect(prefersCoarsePointer(null)).toBe(false)
    expect(prefersCoarsePointer(undefined)).toBe(false)
    expect(prefersCoarsePointer('nope')).toBe(false)
  })
})

describe('detectCoarsePointer', () => {
  it('uses host.matchMedia when available', () => {
    const host = {
      matchMedia: (query) => ({
        matches: query === '(pointer: coarse)',
      }),
    }
    expect(detectCoarsePointer(host)).toBe(true)
  })

  it('returns false when matchMedia is unavailable', () => {
    expect(detectCoarsePointer({})).toBe(false)
    expect(detectCoarsePointer(null)).toBe(false)
  })
})

describe('getOrbitTouches', () => {
  it('reserves one finger for taps on coarse pointers', () => {
    expect(getOrbitTouches(true)).toEqual({
      ONE: null,
      TWO: ORBIT_TOUCH.DOLLY_ROTATE,
    })
  })

  it('keeps classic mouse / trackpad orbit on fine pointers', () => {
    expect(getOrbitTouches(false)).toEqual({
      ONE: ORBIT_TOUCH.ROTATE,
      TWO: ORBIT_TOUCH.DOLLY_PAN,
    })
  })
})

describe('getSquareHitHeight', () => {
  it('uses a taller pick volume for coarse pointers', () => {
    expect(getSquareHitHeight(true)).toBe(SQUARE_HIT_HEIGHT_COARSE)
    expect(getSquareHitHeight(false)).toBe(SQUARE_HIT_HEIGHT)
    expect(SQUARE_HIT_HEIGHT_COARSE).toBeGreaterThan(SQUARE_HIT_HEIGHT)
  })
})
