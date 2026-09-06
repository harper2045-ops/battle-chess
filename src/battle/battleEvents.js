const oppositeColor = {
  w: 'b',
  b: 'w',
}

/** chess.js castle flags: 'k' kingside, 'q' queenside. */
function castlingCompanion(move) {
  if (!move?.flags) return null
  const kingside = move.flags.includes('k')
  const queenside = move.flags.includes('q')
  if (!kingside && !queenside) return null

  const rank = move.from[1]
  return {
    piece: { type: 'r', color: move.color },
    from: kingside ? `h${rank}` : `a${rank}`,
    to: kingside ? `f${rank}` : `d${rank}`,
  }
}

export function createCaptureEvent(move, id = 0) {
  if (!move?.captured) return null

  return {
    id,
    type: 'capture',
    attacker: {
      type: move.piece,
      color: move.color,
    },
    defender: {
      type: move.captured,
      color: oppositeColor[move.color],
    },
    from: move.from,
    to: move.to,
    defenderSquare: move.flags.includes('e')
      ? `${move.to[0]}${move.from[1]}`
      : move.to,
    promotion: move.promotion ?? null,
  }
}


export function createQuietMoveEvent(move, id = 0) {
  if (!move || move.captured) return null

  const companions = []
  const rook = castlingCompanion(move)
  if (rook) companions.push(rook)

  return {
    id,
    type: 'move',
    piece: {
      // Promote visually on arrival — walk as the piece that will sit on `to`.
      type: move.promotion ?? move.piece,
      color: move.color,
    },
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
    companions,
  }
}

export function getCapturedPieces(moves) {
  return moves.reduce(
    (captured, move) => {
      if (move.captured) {
        captured[oppositeColor[move.color]].push(move.captured)
      }

      return captured
    },
    { w: [], b: [] },
  )
}

export function getPositionFeedback(chess) {
  if (chess.isCheckmate()) return 'checkmate'
  if (chess.inCheck()) return 'check'
  return 'normal'
}
