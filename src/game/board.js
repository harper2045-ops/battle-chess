export function squareFromCoords(row, col) {
  return String.fromCharCode(97 + col) + (8 - row)
}

export function getOrientedBoard(board, orientation = 'w') {
  const squares = board.map((row, rowIndex) =>
    row.map((piece, colIndex) => ({
      piece,
      square: squareFromCoords(rowIndex, colIndex),
    })),
  )

  if (orientation === 'b') {
    return squares.reverse().map((row) => row.reverse())
  }

  return squares
}
