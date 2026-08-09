import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { getCapturedPieces } from '../battle/battleEvents.js'
import {
  createBotRequestGuard,
  createHistoryController,
} from './history.js'

describe('game history', () => {
  it('undoes and redoes one move in human mode', () => {
    const chess = new Chess()
    const history = createHistoryController(chess)
    chess.move('e4')
    history.recordMove()
    chess.move('e5')
    history.recordMove()

    expect(history.undo('human')).toBe(1)
    expect(chess.history()).toEqual(['e4'])
    expect(history.redo().map((move) => move.san)).toEqual(['e5'])
    expect(chess.history()).toEqual(['e4', 'e5'])
  })

  it('undoes and redoes a complete player and bot turn', () => {
    const chess = new Chess()
    const history = createHistoryController(chess)
    chess.move('e4')
    history.recordMove()
    chess.move('e5')
    history.recordMove()

    expect(history.undo('bot')).toBe(2)
    expect(chess.history()).toEqual([])
    expect(history.redo().map((move) => move.san)).toEqual(['e4', 'e5'])
  })

  it('undoes an unmatched player move while the bot reply is pending', () => {
    const chess = new Chess()
    const history = createHistoryController(chess)
    chess.move('e4')
    history.recordMove()

    expect(history.undo('bot')).toBe(1)
    expect(chess.history()).toEqual([])
    expect(history.redo().map((move) => move.san)).toEqual(['e4'])
  })

  it('keeps captures and move history accurate across undo and redo', () => {
    const chess = new Chess()
    const history = createHistoryController(chess)
    for (const move of ['e4', 'd5', 'exd5']) {
      chess.move(move)
      history.recordMove()
    }

    expect(getCapturedPieces(chess.history({ verbose: true })).b).toEqual(['p'])
    history.undo('human')
    expect(chess.history()).toEqual(['e4', 'd5'])
    expect(getCapturedPieces(chess.history({ verbose: true })).b).toEqual([])
    history.redo()
    expect(chess.history()).toEqual(['e4', 'd5', 'exd5'])
    expect(getCapturedPieces(chess.history({ verbose: true })).b).toEqual(['p'])
  })

  it('clears redo history on reset or a new move', () => {
    const chess = new Chess()
    const history = createHistoryController(chess)
    chess.move('e4')
    history.recordMove()
    history.undo('human')
    chess.reset()
    history.clear()
    expect(history.canRedo()).toBe(false)

    chess.move('d4')
    history.recordMove()
    history.undo('human')
    chess.move('c4')
    history.recordMove()
    expect(history.canRedo()).toBe(false)
  })
})

describe('bot request guard', () => {
  it('invalidates stale bot responses before history changes', () => {
    const guard = createBotRequestGuard()
    const pendingRequest = guard.capture()

    guard.invalidate()

    expect(guard.isCurrent(pendingRequest)).toBe(false)
    expect(guard.isCurrent(guard.capture())).toBe(true)
  })
})
