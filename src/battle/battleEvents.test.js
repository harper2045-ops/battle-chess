import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import {
  createCaptureEvent,
  getCapturedPieces,
  getPositionFeedback,
} from './battleEvents.js'

describe('battle presentation events', () => {
  it('creates structured capture data from an authoritative chess move', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('d5')

    const move = chess.move('exd5')

    expect(createCaptureEvent(move, 7)).toEqual({
      id: 7,
      type: 'capture',
      attacker: { type: 'p', color: 'w' },
      defender: { type: 'p', color: 'b' },
      from: 'e4',
      to: 'd5',
      defenderSquare: 'd5',
      promotion: null,
    })
  })

  it('includes the defender actual square for en passant', () => {
    const chess = new Chess(
      '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
    )

    expect(createCaptureEvent(chess.move('exd6'))).toMatchObject({
      from: 'e5',
      to: 'd6',
      defenderSquare: 'd5',
      promotion: null,
    })
  })

  it('includes promotion metadata for a promotion capture', () => {
    const chess = new Chess('4k2r/6P1/8/8/8/8/8/4K3 w - - 0 1')

    expect(createCaptureEvent(chess.move('gxh8=Q'))).toMatchObject({
      attacker: { type: 'p', color: 'w' },
      defender: { type: 'r', color: 'b' },
      from: 'g7',
      to: 'h8',
      defenderSquare: 'h8',
      promotion: 'q',
    })
  })

  it('does not create a battle event for a non-capture', () => {
    const chess = new Chess()

    expect(createCaptureEvent(chess.move('e4'))).toBeNull()
  })

  it('derives captured pieces by their original color', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('d5')
    chess.move('exd5')
    chess.move('Qxd5')

    expect(getCapturedPieces(chess.history({ verbose: true }))).toEqual({
      w: ['p'],
      b: ['p'],
    })
  })

  it('reports check and checkmate feedback independently of presentation', () => {
    const check = new Chess('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1')
    const checkmate = new Chess(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    )

    expect(getPositionFeedback(new Chess())).toBe('normal')
    expect(getPositionFeedback(check)).toBe('check')
    expect(getPositionFeedback(checkmate)).toBe('checkmate')
  })
})
