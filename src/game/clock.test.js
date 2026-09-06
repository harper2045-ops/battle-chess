import { describe, expect, it } from 'vitest'
import {
  createClockController,
  formatClock,
  isLowTime,
} from './clock.js'

function createTestClock(controlId = '3+2') {
  let timestamp = 0
  const clock = createClockController(controlId, () => timestamp)
  return {
    clock,
    advance(milliseconds) {
      timestamp += milliseconds
    },
  }
}

describe('match clock', () => {
  it('keeps both clocks disabled for untimed matches', () => {
    const { clock, advance } = createTestClock('untimed')
    advance(30_000)

    const state = clock.getState()

    expect(state.enabled).toBe(false)
    expect(state.running).toBe(false)
    expect(state.activeColor).toBeNull()
    expect(state.remainingMs).toEqual({ w: null, b: null })
  })

  it('starts White and can pause without losing background time', () => {
    const { clock, advance } = createTestClock()
    advance(1_000)
    expect(clock.getState().remainingMs.w).toBe(179_000)

    clock.pause()
    advance(10_000)
    expect(clock.getState().remainingMs.w).toBe(179_000)

    clock.resume()
    advance(500)
    expect(clock.getState().remainingMs.w).toBe(178_500)
  })

  it('applies increment and switches the active side after a move', () => {
    const { clock, advance } = createTestClock()
    advance(1_500)

    const state = clock.completeMove('w', 'b')

    expect(state.remainingMs.w).toBe(180_500)
    expect(state.activeColor).toBe('b')
    expect(state.running).toBe(true)
  })

  it('ends cleanly on timeout', () => {
    const { clock, advance } = createTestClock('1+0')
    advance(60_001)

    const state = clock.getState()

    expect(state.remainingMs.w).toBe(0)
    expect(state.timedOutColor).toBe('w')
    expect(state.activeColor).toBeNull()
    expect(state.running).toBe(false)
  })

  it('reconciles elapsed time after a long background gap', () => {
    const { clock, advance } = createTestClock('5+0')
    advance(47_250)

    expect(clock.getState().remainingMs.w).toBe(252_750)
  })

  it('restores exact clock snapshots across undo and redo', () => {
    const { clock, advance } = createTestClock()
    advance(1_000)
    clock.completeMove('w', 'b')
    advance(2_000)
    const afterBlack = clock.completeMove('b', 'w')

    const undone = clock.undo(2)
    expect(undone.remainingMs).toEqual({ w: 180_000, b: 180_000 })
    expect(undone.activeColor).toBe('w')

    const redone = clock.redo()
    expect(redone.remainingMs).toEqual(afterBlack.remainingMs)
    expect(redone.activeColor).toBe('w')
  })

  it('reset restores the selected time control', () => {
    const { clock, advance } = createTestClock('10+0')
    advance(8_000)
    clock.getState()

    const state = clock.reset('10+0')

    expect(state.remainingMs).toEqual({ w: 600_000, b: 600_000 })
    expect(state.activeColor).toBe('w')
  })

  it('charges bot thinking time to the bot active color', () => {
    const { clock, advance } = createTestClock('1+0')
    advance(1_000)
    clock.completeMove('w', 'b')
    advance(3_500)

    expect(clock.getState().remainingMs.b).toBe(56_500)
  })

  it('stops after a chess game-over move', () => {
    const { clock, advance } = createTestClock()
    advance(1_000)

    const state = clock.completeMove('w', 'b', true)

    expect(state.running).toBe(false)
    expect(state.activeColor).toBeNull()
    advance(5_000)
    expect(clock.getState().remainingMs.w).toBe(state.remainingMs.w)
  })

  it('formats remaining time for display', () => {
    expect(formatClock(180_000)).toBe('3:00')
    expect(formatClock(61_001)).toBe('1:02')
    expect(formatClock(10_000)).toBe('0:10')
    expect(formatClock(9_999)).toBe('0:09.9')
    expect(formatClock(1_050)).toBe('0:01.0')
    expect(formatClock(99)).toBe('0:00.0')
    expect(formatClock(0)).toBe('0:00.0')
    expect(formatClock(null)).toBe('--:--')
  })

  it('flags low time under thirty seconds', () => {
    expect(isLowTime(30_000)).toBe(false)
    expect(isLowTime(29_999)).toBe(true)
    expect(isLowTime(1)).toBe(true)
    expect(isLowTime(0)).toBe(false)
    expect(isLowTime(null)).toBe(false)
  })
})
