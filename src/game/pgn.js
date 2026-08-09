export function getGamePgn(chess) {
  return chess.pgn({ newline: '\n' })
}

export function createPgnFilename(date = new Date()) {
  return `battle-chess-${date.toISOString().slice(0, 10)}.pgn`
}

export async function copyPgn(pgn, clipboard) {
  if (!pgn) throw new Error('No moves to copy')
  if (!clipboard?.writeText) throw new Error('Clipboard is unavailable')

  await clipboard.writeText(pgn)
}
