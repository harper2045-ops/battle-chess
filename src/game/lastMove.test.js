import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import {
  getLastMove,
  isLastMoveSquare,
  squareHighlightColor,
} from './lastMove.js'

describe('getLastMove', () => {
  it('returns null when history is empty or invalid', () => {
    expect(getLastMove([])).toBeNull()
    expect(getLastMove(null)).toBeNull()
    expect(getLastMove([{ san: 'e4' }])).toBeNull()
  })

  it('returns from/to of the latest ply', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Nf3')

    expect(getLastMove(chess.history({ verbose: true }))).toEqual({
      from: 'g1',
      to: 'f3',
    })
  })

  it('tracks undo by reading the updated history', () => {
    const chess = new Chess()
    chess.move('d4')
    chess.move('d5')
    expect(getLastMove(chess.history({ verbose: true }))).toEqual({
      from: 'd7',
      to: 'd5',
    })

    chess.undo()
    expect(getLastMove(chess.history({ verbose: true }))).toEqual({
      from: 'd2',
      to: 'd4',
    })

    chess.undo()
    expect(getLastMove(chess.history({ verbose: true }))).toBeNull()
  })
})

describe('isLastMoveSquare', () => {
  it('matches both origin and destination', () => {
    const last = { from: 'e2', to: 'e4' }
    expect(isLastMoveSquare(last, 'e2')).toBe(true)
    expect(isLastMoveSquare(last, 'e4')).toBe(true)
    expect(isLastMoveSquare(last, 'e3')).toBe(false)
    expect(isLastMoveSquare(null, 'e2')).toBe(false)
  })
})

describe('squareHighlightColor', () => {
  it('prefers selected, then legal, then last-move over board tint', () => {
    expect(
      squareHighlightColor({
        isSelected: true,
        isLegal: true,
        isLastMove: true,
        isDark: true,
      }),
    ).toBe('#d5a229')

    expect(
      squareHighlightColor({
        isSelected: false,
        isLegal: true,
        isLastMove: true,
        isDark: false,
      }),
    ).toBe('#63895b')

    expect(
      squareHighlightColor({
        isSelected: false,
        isLegal: false,
        isLastMove: true,
        isDark: true,
      }),
    ).toBe('#9a7a32')

    expect(
      squareHighlightColor({
        isSelected: false,
        isLegal: false,
        isLastMove: true,
        isDark: false,
      }),
    ).toBe('#e2c76a')

    expect(
      squareHighlightColor({
        isSelected: false,
        isLegal: false,
        isLastMove: false,
        isDark: true,
      }),
    ).toBe('#755038')
  })
})
