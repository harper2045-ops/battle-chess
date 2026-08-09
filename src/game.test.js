import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'

describe('chess game rules', () => {
  it('accepts a basic legal move', () => {
    const chess = new Chess()

    const move = chess.move({ from: 'e2', to: 'e4' })

    expect(move.san).toBe('e4')
    expect(chess.get('e4')).toMatchObject({ type: 'p', color: 'w' })
    expect(chess.turn()).toBe('b')
  })

  it('rejects an illegal move without changing the position', () => {
    const chess = new Chess()
    const startingFen = chess.fen()

    expect(() => chess.move({ from: 'e2', to: 'e5' })).toThrow()
    expect(chess.fen()).toBe(startingFen)
    expect(chess.history()).toEqual([])
  })

  it('detects checkmate and a game-over state', () => {
    const chess = new Chess()

    chess.move('f3')
    chess.move('e5')
    chess.move('g4')
    chess.move('Qh4#')

    expect(chess.inCheck()).toBe(true)
    expect(chess.isCheckmate()).toBe(true)
    expect(chess.isGameOver()).toBe(true)
    expect(chess.turn()).toBe('w')
  })

  it('resets the board, turn, and move history', () => {
    const chess = new Chess()
    const startingFen = chess.fen()

    chess.move('e4')
    chess.move('e5')
    chess.reset()

    expect(chess.fen()).toBe(startingFen)
    expect(chess.turn()).toBe('w')
    expect(chess.history()).toEqual([])
    expect(chess.isGameOver()).toBe(false)
  })
})
