import { describe, expect, it } from 'vitest'
import { clearedPresentationState } from './presentation.js'

describe('clearedPresentationState', () => {
  it('nulls in-flight move and capture actors', () => {
    const state = clearedPresentationState()
    expect(state.activeCapture).toBeNull()
    expect(state.activeMove).toBeNull()
    expect(state.battleEvent).toBeNull()
  })

  it('clears selection and thinking flags', () => {
    const state = clearedPresentationState()
    expect(state.selected).toBeNull()
    expect(state.legalMoves).toEqual([])
    expect(state.thinking).toBe(false)
    expect(state.copyStatus).toBe('')
  })
})
