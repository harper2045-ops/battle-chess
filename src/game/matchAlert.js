const COLOR_NAMES = {
  w: 'White',
  b: 'Black',
}

export function colorName(color) {
  return COLOR_NAMES[color] ?? 'White'
}

/**
 * Elevated match alert (check / mate / draw / timeout) for the cinematic
 * banner. Returns null while play is ordinary so the banner stays hidden.
 */
export function getMatchAlert({
  feedback,
  matchResult = null,
  turn = 'w',
  isDraw = false,
} = {}) {
  if (matchResult?.type === 'timeout') {
    const winner = matchResult.winner ?? (matchResult.timedOutColor === 'w' ? 'b' : 'w')
    return {
      kind: 'timeout',
      glyph: '⌛',
      title: 'Time',
      detail: `${colorName(winner)} wins on time`,
    }
  }

  if (feedback === 'checkmate') {
    return {
      kind: 'checkmate',
      glyph: '⚔️',
      title: 'Checkmate',
      detail: `${colorName(turn === 'w' ? 'b' : 'w')} wins`,
    }
  }

  if (isDraw) {
    return {
      kind: 'draw',
      glyph: '½',
      title: 'Draw',
      detail: 'The armies stand down',
    }
  }

  if (feedback === 'check') {
    return {
      kind: 'check',
      glyph: '⚠️',
      title: 'Check',
      detail: `${colorName(turn)} is under fire`,
    }
  }

  return null
}

/** Compact status-line copy; keeps turn / elevated states in one place. */
export function formatMatchStatus({
  feedback,
  matchResult = null,
  turn = 'w',
  isDraw = false,
} = {}) {
  if (matchResult?.type === 'timeout') {
    const winner = matchResult.winner ?? (matchResult.timedOutColor === 'w' ? 'b' : 'w')
    return `${colorName(winner)} wins on TIME`
  }

  if (feedback === 'checkmate') {
    return `CHECKMATE — ${colorName(turn === 'w' ? 'b' : 'w')} wins`
  }

  if (isDraw) return 'DRAW'

  if (feedback === 'check') {
    return `${colorName(turn)} is in CHECK`
  }

  return `${colorName(turn)} to move`
}
