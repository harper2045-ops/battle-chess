import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import {
  createCaptureEvent,
  createQuietMoveEvent,
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


  it('creates a quiet move event for non-captures', () => {
    const chess = new Chess()
    const move = chess.move('e4')

    expect(createQuietMoveEvent(move, 3)).toEqual({
      id: 3,
      type: 'move',
      piece: { type: 'p', color: 'w' },
      from: 'e2',
      to: 'e4',
      promotion: null,
      companions: [],
    })
  })

  it('adds a rook companion for kingside castling', () => {
    const chess = new Chess(
      'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    )
    const move = chess.move('O-O')
    expect(createQuietMoveEvent(move, 9)).toMatchObject({
      piece: { type: 'k', color: 'w' },
      from: 'e1',
      to: 'g1',
      companions: [
        { piece: { type: 'r', color: 'w' }, from: 'h1', to: 'f1' },
      ],
    })
  })

  it('adds a rook companion for queenside castling', () => {
    const chess = new Chess(
      'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    )
    const move = chess.move('O-O-O')
    expect(createQuietMoveEvent(move)).toMatchObject({
      piece: { type: 'k', color: 'w' },
      from: 'e1',
      to: 'c1',
      companions: [
        { piece: { type: 'r', color: 'w' }, from: 'a1', to: 'd1' },
      ],
    })
  })

  it('does not create a quiet move event for captures', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('d5')
    expect(createQuietMoveEvent(chess.move('exd5'))).toBeNull()
  })

  it('uses the promoted piece type for quiet promotions', () => {
    const chess = new Chess('4k3/6P1/8/8/8/8/8/4K3 w - - 0 1')
    expect(createQuietMoveEvent(chess.move('g8=Q'))).toMatchObject({
      piece: { type: 'q', color: 'w' },
      from: 'g7',
      to: 'g8',
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
