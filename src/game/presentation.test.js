import { describe, expect, it } from 'vitest'
import { createClockController } from './clock.js'
import {
  clearedPresentationState,
  resetClockForScreen,
  resumeClockForScreen,
} from './presentation.js'

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

describe('screen clock lifecycle', () => {
  it('keeps a timed setup paused until Start', () => {
    let now = 0
    const clock = createClockController('untimed', () => now)
    const setup = resetClockForScreen(clock, '1+0', 'menu')
    expect(setup.running).toBe(false)
    expect(setup.remainingMs.w).toBe(60_000)

    now = 5_000
    expect(resumeClockForScreen(clock).running).toBe(true)
    now = 6_000
    expect(clock.getState().remainingMs.w).toBe(59_000)
  })
})
