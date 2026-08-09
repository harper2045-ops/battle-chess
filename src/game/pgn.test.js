import { describe, expect, it, vi } from 'vitest'
import { Chess } from 'chess.js'
import { copyPgn, createPgnFilename, getGamePgn } from './pgn.js'

describe('PGN export', () => {
  it('exports the authoritative chess history as PGN', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Nf3')

    expect(getGamePgn(chess)).toContain('1. e4 e5 2. Nf3')
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
