function toMoveInput(move) {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  }
}

function canUndo(chess, mode, playerColor) {
  const plyCount = chess.history().length
  return !(
    plyCount === 0 ||
    (mode === 'bot' && playerColor === 'b' && plyCount === 1)
  )
}

export function createHistoryController(chess) {
  const redoTurns = []

  return {
    clear() {
      redoTurns.length = 0
    },

    canRedo() {
      return redoTurns.length > 0
    },

    canUndo(mode, playerColor = 'w') {
      return canUndo(chess, mode, playerColor)
    },

    recordMove() {
      redoTurns.length = 0
    },

    undo(mode, playerColor = 'w') {
      if (!canUndo(chess, mode, playerColor)) return 0

      const plyCount = chess.history().length
      const undoCount =
        mode === 'bot' && plyCount > 1 && chess.turn() === playerColor
          ? 2
          : 1
      const moves = []

      for (let index = 0; index < undoCount; index += 1) {
        const move = chess.undo()
        if (!move) break
        moves.unshift(toMoveInput(move))
      }

      if (moves.length) redoTurns.push(moves)
      return moves.length
    },

    redo() {
      const moves = redoTurns.pop()
      if (!moves) return []

      return moves.map((move) => chess.move(move))
    },
  }
}

export function createBotRequestGuard() {
  let version = 0

  return {
    capture() {
      return version
    },

    invalidate() {
      version += 1
    },

    isCurrent(requestVersion) {
      return requestVersion === version
    },
  }
}
