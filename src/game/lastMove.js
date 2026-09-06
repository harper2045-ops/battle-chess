/**
 * Last committed ply from chess.js verbose history, for board highlights.
 * Presentation-only — never feeds legality or engine decisions.
 */
export function getLastMove(verboseHistory) {
  if (!Array.isArray(verboseHistory) || verboseHistory.length === 0) {
    return null
  }

  const move = verboseHistory[verboseHistory.length - 1]
  if (!move || typeof move.from !== 'string' || typeof move.to !== 'string') {
    return null
  }

  return { from: move.from, to: move.to }
}

export function isLastMoveSquare(lastMove, square) {
  return Boolean(
    lastMove && (square === lastMove.from || square === lastMove.to),
  )
}

/** Priority: selected > legal > last-move > light/dark board. */
export function squareHighlightColor({
  isSelected,
  isLegal,
  isLastMove,
  isDark,
}) {
  if (isSelected) return '#d5a229'
  if (isLegal) return '#63895b'
  if (isLastMove) return isDark ? '#9a7a32' : '#e2c76a'
  return isDark ? '#755038' : '#d8bd86'
}
