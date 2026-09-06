import { describe, expect, it, vi } from 'vitest'
import { Chess } from 'chess.js'
import {
  buildPgnHeaders,
  copyPgn,
  createPgnFilename,
  formatPgnDate,
  getGamePgn,
  resolvePgnPlayers,
  resolvePgnResult,
} from './pgn.js'

describe('PGN export', () => {
  it('formats UTC calendar dates for PGN tags', () => {
    expect(formatPgnDate(new Date('2026-09-06T22:15:00Z'))).toBe('2026.09.06')
  })

  it('resolves players for human and bot matches', () => {
    expect(resolvePgnPlayers({ mode: 'human' })).toEqual({
      White: 'Human',
      Black: 'Human',
    })
    expect(
      resolvePgnPlayers({
        mode: 'bot',
        playerColor: 'w',
        difficulty: 'hard',
      }),
    ).toEqual({ White: 'Human', Black: 'Bot (Hard)' })
    expect(
      resolvePgnPlayers({
        mode: 'bot',
        playerColor: 'b',
        difficulty: 'easy',
      }),
    ).toEqual({ White: 'Bot (Easy)', Black: 'Human' })
  })

  it('resolves Result for mate, draw, timeout, and ongoing games', () => {
    const mate = new Chess()
    mate.move('f3')
    mate.move('e5')
    mate.move('g4')
    mate.move('Qh4#')
    expect(resolvePgnResult(mate)).toBe('0-1')

    const draw = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(resolvePgnResult(draw)).toBe('1/2-1/2')

    const live = new Chess()
    live.move('e4')
    expect(resolvePgnResult(live)).toBe('*')
    expect(resolvePgnResult(live, { type: 'timeout', winner: 'b' })).toBe('0-1')
  })

  it('exports authoritative history with Battle Chess headers', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Nf3')

    const pgn = getGamePgn(chess, {
      mode: 'bot',
      playerColor: 'w',
      difficulty: 'medium',
      date: new Date('2026-09-06T15:00:00Z'),
    })

    expect(pgn).toContain('[Event "Battle Chess"]')
    expect(pgn).toContain('[Site "Local"]')
    expect(pgn).toContain('[Date "2026.09.06"]')
    expect(pgn).toContain('[White "Human"]')
    expect(pgn).toContain('[Black "Bot (Medium)"]')
    expect(pgn).toContain('[Result "*"]')
    expect(pgn).toContain('1. e4 e5 2. Nf3 *')
    expect(pgn).not.toContain('[Event "?"]')
  })

  it('writes the mate Result into both the header and movetext', () => {
    const chess = new Chess()
    chess.move('f3')
    chess.move('e5')
    chess.move('g4')
    chess.move('Qh4#')

    const pgn = getGamePgn(chess, {
      date: new Date('2026-09-06T12:00:00Z'),
    })
    const headers = buildPgnHeaders(chess, {
      date: new Date('2026-09-06T12:00:00Z'),
    })

    expect(headers.Result).toBe('0-1')
    expect(pgn).toContain('[Result "0-1"]')
    expect(pgn.trim().endsWith('0-1')).toBe(true)
    expect(pgn).not.toMatch(/\*\s*$/)
  })

  it('creates a stable dated filename', () => {
    expect(createPgnFilename(new Date('2026-08-09T22:00:00Z'))).toBe(
      'battle-chess-2026-08-09.pgn',
    )
  })

  it('copies PGN through the provided clipboard', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue() }

    await copyPgn('1. e4 *', clipboard)

    expect(clipboard.writeText).toHaveBeenCalledWith('1. e4 *')
  })

  it('rejects empty games and unavailable clipboards', async () => {
    await expect(copyPgn('', {})).rejects.toThrow('No moves to copy')
    await expect(copyPgn('1. e4 *', null)).rejects.toThrow(
      'Clipboard is unavailable',
    )
  })
})
