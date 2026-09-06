import { describe, expect, it } from 'vitest'
import { formatMatchStatus, getMatchAlert } from './matchAlert.js'

describe('match alert banner data', () => {
  it('stays quiet for ordinary play', () => {
    expect(
      getMatchAlert({ feedback: 'normal', turn: 'w', isDraw: false }),
    ).toBeNull()
  })

  it('builds a check alert for the side to move', () => {
    expect(
      getMatchAlert({ feedback: 'check', turn: 'b', isDraw: false }),
    ).toEqual({
      kind: 'check',
      glyph: '⚠️',
      title: 'Check',
      detail: 'Black is under fire',
    })
  })

  it('builds a checkmate alert for the winner', () => {
    expect(
      getMatchAlert({ feedback: 'checkmate', turn: 'w', isDraw: false }),
    ).toEqual({
      kind: 'checkmate',
      glyph: '⚔️',
      title: 'Checkmate',
      detail: 'Black wins',
    })
  })

  it('builds a draw alert', () => {
    expect(
      getMatchAlert({ feedback: 'normal', turn: 'w', isDraw: true }),
    ).toMatchObject({
      kind: 'draw',
      title: 'Draw',
    })
  })

  it('prefers timeout over position feedback', () => {
    expect(
      getMatchAlert({
        feedback: 'check',
        turn: 'w',
        isDraw: false,
        matchResult: { type: 'timeout', winner: 'b' },
      }),
    ).toEqual({
      kind: 'timeout',
      glyph: '⌛',
      title: 'Time',
      detail: 'Black wins on time',
    })
  })
})

describe('match status line', () => {
  it('keeps the existing elevated copy', () => {
    expect(
      formatMatchStatus({
        feedback: 'checkmate',
        turn: 'b',
        isDraw: false,
      }),
    ).toBe('CHECKMATE — White wins')

    expect(
      formatMatchStatus({
        feedback: 'check',
        turn: 'w',
        isDraw: false,
      }),
    ).toBe('White is in CHECK')

    expect(
      formatMatchStatus({
        feedback: 'normal',
        turn: 'b',
        isDraw: true,
      }),
    ).toBe('DRAW')

    expect(
      formatMatchStatus({
        feedback: 'normal',
        turn: 'w',
        isDraw: false,
        matchResult: { type: 'timeout', winner: 'w' },
      }),
    ).toBe('White wins on TIME')
  })

  it('falls back to turn-to-move', () => {
    expect(
      formatMatchStatus({ feedback: 'normal', turn: 'b', isDraw: false }),
    ).toBe('Black to move')
  })
})
