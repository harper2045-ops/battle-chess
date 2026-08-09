import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { getOrientedBoard, squareFromCoords } from './board.js'

describe('board orientation', () => {
  it('maps display coordinates to chess squares', () => {
    expect(squareFromCoords(0, 0)).toBe('a8')
    expect(squareFromCoords(7, 7)).toBe('h1')
  })

  it('places White at the bottom by default', () => {
    const board = getOrientedBoard(new Chess().board(), 'w')

    expect(board[0][0].square).toBe('a8')
    expect(board[7][7].square).toBe('h1')
    expect(board[7][4].piece).toMatchObject({ type: 'k', color: 'w' })
  })

  it('rotates both ranks and files for Black orientation', () => {
    const board = getOrientedBoard(new Chess().board(), 'b')

    expect(board[0][0].square).toBe('h1')
    expect(board[7][7].square).toBe('a8')
    expect(board[7][3].piece).toMatchObject({ type: 'k', color: 'b' })
  })
})
