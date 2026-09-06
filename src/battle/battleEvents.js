const oppositeColor = {
  w: 'b',
  b: 'w',
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
