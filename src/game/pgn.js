const RESULT_TOKENS = /\s+(\*|1-0|0-1|1\/2-1\/2)\s*$/

export function formatPgnDate(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

export function resolvePgnResult(chess, matchResult = null) {
  if (matchResult?.type === 'timeout') {
    return matchResult.winner === 'w' ? '1-0' : '0-1'
  }
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? '0-1' : '1-0'
  }
  if (chess.isDraw()) return '1/2-1/2'
  return '*'
}

export function resolvePgnPlayers({
  mode = 'human',
  playerColor = 'w',
  difficulty = 'medium',
} = {}) {
  if (mode !== 'bot') {
    return { White: 'Human', Black: 'Human' }
  }

  const label = difficulty[0].toUpperCase() + difficulty.slice(1)
  const bot = `Bot (${label})`
  return playerColor === 'w'
    ? { White: 'Human', Black: bot }
    : { White: bot, Black: 'Human' }
}

export function buildPgnHeaders(chess, meta = {}) {
  const players = resolvePgnPlayers(meta)
  return {
    Event: meta.event ?? 'Battle Chess',
    Site: meta.site ?? 'Local',
    Date: formatPgnDate(meta.date),
    Round: meta.round ?? '1',
    White: players.White,
    Black: players.Black,
    Result: resolvePgnResult(chess, meta.matchResult),
  }
}

function formatPgnHeaders(headers) {
  return Object.entries(headers)
    .map(([key, value]) => `[${key} "${value}"]`)
    .join('\n')
}

function extractMovetext(pgn) {
  const blank = pgn.indexOf('\n\n')
  if (blank === -1) return pgn.trim()
  return pgn.slice(blank + 2).trim()
}

function withTrailingResult(movetext, result) {
  const stripped = movetext.replace(RESULT_TOKENS, '').trim()
  if (!stripped) return result
  return `${stripped} ${result}`
}

export function getGamePgn(chess, meta = {}) {
  const headers = buildPgnHeaders(chess, meta)
  const movetext = withTrailingResult(
    extractMovetext(chess.pgn({ newline: '\n' })),
    headers.Result,
  )
  return `${formatPgnHeaders(headers)}\n\n${movetext}`
}

export function createPgnFilename(date = new Date()) {
  return `battle-chess-${date.toISOString().slice(0, 10)}.pgn`
}

export async function copyPgn(pgn, clipboard) {
  if (!pgn) throw new Error('No moves to copy')
  if (!clipboard?.writeText) throw new Error('Clipboard is unavailable')

  await clipboard.writeText(pgn)
}
