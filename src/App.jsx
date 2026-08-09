import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { getStockfishMove } from './engine/stockfishEngine'
const pieceSymbols = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
  P: '♙',
  N: '♘',
  B: '♗',
  R: '♖',
  Q: '♕',
  K: '♔',
}
export default function App() {
  const chess = useMemo(() => new Chess(), [])

  const [difficulty, setDifficulty] = useState('medium')


  const [, refresh] = useState(0)
  const [selected, setSelected] = useState(null)
  const [legalMoves, setLegalMoves] = useState([])
  const [mode, setMode] = useState('human')
  const [thinking, setThinking] = useState(false)
  const [history, setHistory] = useState([])

  const board = chess.board()

  const squareFromCoords = (row, col) =>
    String.fromCharCode(97 + col) + (8 - row)

  const updateScreen = () => {
    refresh((n) => n + 1)
  }

  const clearSelection = () => {
    setSelected(null)
    setLegalMoves([])
  }

  const selectPiece = (square) => {
    const piece = chess.get(square)

    if (!piece || piece.color !== chess.turn()) return

    setSelected(square)

    const moves = chess.moves({
      square,
      verbose: true,
    })

    setLegalMoves(moves.map((move) => move.to))
  }

const makeBotMove = async () => {
  if (mode !== 'bot' || chess.isGameOver()) return

  setThinking(true)

  try {
const depthMap = {
  easy: 5,
  medium: 10,
  hard: 15,
}

const bestMove = await getStockfishMove(
  chess.fen(),
  depthMap[difficulty]
    )

    const from = bestMove.slice(0, 2)
    const to = bestMove.slice(2, 4)

    const promotion =
      bestMove.length > 4 ? bestMove[4] : 'q'

    const result = chess.move({
      from,
      to,
      promotion,
    })

    if (result) {
      setHistory((old) => [...old, result.san])
      updateScreen()
    }
  } catch (error) {
    console.error('Stockfish error:', error)
  }

  setThinking(false)
}

  const handleClick = (row, col) => {
    if (thinking || chess.isGameOver()) return

    const square = squareFromCoords(row, col)
    const piece = chess.get(square)

    if (!selected) {
      if (mode === 'bot' && chess.turn() === 'b') return

      selectPiece(square)
      return
    }

    if (
      piece &&
      piece.color === chess.turn() &&
      square !== selected
    ) {
      selectPiece(square)
      return
    }

    try {
      const move = chess.move({
        from: selected,
        to: square,
        promotion: 'q',
      })

      if (!move) {
        clearSelection()
        return
      }

      setHistory((old) => [...old, move.san])
      clearSelection()
      updateScreen()

      if (
        mode === 'bot' &&
        chess.turn() === 'b' &&
        !chess.isGameOver()
      ) {
        setTimeout(makeBotMove, 100)
      }
    } catch (error) {
      console.warn(error)
      clearSelection()
    }
  }

  const resetGame = () => {
    chess.reset()
    clearSelection()
    setHistory([])
    setThinking(false)
    updateScreen()
  }

  const changeMode = (newMode) => {
    chess.reset()
    setMode(newMode)
    clearSelection()
    setHistory([])
    setThinking(false)
    updateScreen()
  }

  const status = () => {
    if (chess.isCheckmate()) {
      return `CHECKMATE — ${
        chess.turn() === 'w' ? 'Black' : 'White'
      } wins`
    }

    if (chess.isDraw()) return 'DRAW'

    if (chess.inCheck()) {
      return `${
        chess.turn() === 'w' ? 'White' : 'Black'
      } is in CHECK`
    }

    return `${
      chess.turn() === 'w' ? 'White' : 'Black'
    } to move`
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, #242449, #090910)',
        color: 'white',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'system-ui',
      }}
    >
      <h1>⚔️ BATTLE CHESS</h1>

      <p>Real chess underneath. A cinematic war game on top.</p>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <button onClick={() => changeMode('human')}>
          Human vs Human
        </button>

        <button onClick={() => changeMode('bot')}>
          Human vs Bot
        </button>

        <button onClick={resetGame}>
          Reset Match
        </button>
        {mode === 'bot' && (
  <div
    style={{
      display: 'flex',
      gap: 10,
      marginBottom: 16,
    }}
  >
    <button
      onClick={() => setDifficulty('easy')}
      style={difficultyButtonStyle(difficulty === 'easy')}
    >
      Easy
    </button>

    <button
      onClick={() => setDifficulty('medium')}
      style={difficultyButtonStyle(difficulty === 'medium')}
    >
      Medium
    </button>

    <button
      onClick={() => setDifficulty('hard')}
      style={difficultyButtonStyle(difficulty === 'hard')}
    >
      Hard
    </button>
  </div>
)}
      </div>

      <h2>
        {thinking ? '🤖 Bot thinking...' : status()}
      </h2>

    <div
  style={{
    width: 'min(92vw, 680px)',
    aspectRatio: '1 / 1',
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gridTemplateRows: 'repeat(8, 1fr)',
    border: '10px solid #3a2b20',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 18px 55px rgba(0, 0, 0, 0.6)',
  }}
>
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const square = squareFromCoords(
              rowIndex,
              colIndex
            )

            const light =
              (rowIndex + colIndex) % 2 === 0

            const legal = legalMoves.includes(square)
            const selectedSquare = selected === square

  const targetPiece = chess.get(square)

const capture =
  legal &&
  targetPiece &&
  selected &&
  chess.get(selected)?.color !== targetPiece.color

let background = light
  ? '#d8bd86'
  : '#755038'

if (selectedSquare) {
  background = '#d6a900'
} else if (capture) {
  background = '#a83b3b'
} else if (legal) {
  background = '#63895b'
}

            let symbol = ''

            if (piece) {
              const key =
                piece.color === 'w'
                  ? piece.type.toUpperCase()
                  : piece.type

              symbol = pieceSymbols[key]
            }

            return (
              <button
                key={square}
                onClick={() =>
                  handleClick(rowIndex, colIndex)
                }
style={{
  border: 'none',
  padding: 0,
  margin: 0,
  background,
  fontSize: 'clamp(30px, 7vw, 62px)',
  cursor:
    thinking || chess.isGameOver()
      ? 'default'
      : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  userSelect: 'none',
}}
              >
                {symbol}
                {legal && !piece && (
  <div
    style={{
      width: '22%',
      height: '22%',
      borderRadius: '50%',
      background: 'rgba(20, 25, 20, 0.4)',
      position: 'absolute',
    }}
  />
)}

{capture && (
  <div
    style={{
      position: 'absolute',
      inset: 5,
      border: '3px solid rgba(255,255,255,0.75)',
      borderRadius: '50%',
      pointerEvents: 'none',
    }}
  />
)}
              </button>
            )
          })
        )}
      </div>

      <div
        style={{
          width: 'min(90vw, 680px)',
          marginTop: 20,
        }}
      >
        <strong>Selected:</strong>{' '}
        {selected
          ? selected.toUpperCase()
          : 'None'}

        <h3>Move History</h3>

        {history.length
          ? history.join('  ')
          : 'No moves yet'}
      </div>
    </div>
  )
function difficultyButtonStyle(active) {
  return {
    border: active
      ? '2px solid #ffd45a'
      : '1px solid rgba(255,255,255,0.25)',
    borderRadius: 8,
    padding: '8px 14px',
    background: active
      ? '#685312'
      : 'rgba(255,255,255,0.08)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 700,
  }
}}