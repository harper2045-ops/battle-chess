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
