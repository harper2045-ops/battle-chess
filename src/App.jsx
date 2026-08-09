import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import {
  createCaptureEvent,
  getCapturedPieces,
  getPositionFeedback,
} from './battle/battleEvents.js'
import {
  BattleBanner,
  CapturedPieces,
} from './components/BattlePresentation.jsx'
import { getStockfishMove } from './engine/stockfishEngine.js'

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

const depthMap = {
  easy: 5,
  medium: 10,
  hard: 15,
}

export default function App() {
  const chess = useMemo(() => new Chess(), [])
  const gameVersion = useRef(0)
  const botTimer = useRef(null)
  const battleId = useRef(0)
  const [, refresh] = useState(0)
  const [difficulty, setDifficulty] = useState('medium')
  const [selected, setSelected] = useState(null)
  const [legalMoves, setLegalMoves] = useState([])
  const [mode, setMode] = useState('human')
  const [thinking, setThinking] = useState(false)
  const [history, setHistory] = useState([])
  const [battleEvent, setBattleEvent] = useState(null)

  const board = chess.board()
  const captured = getCapturedPieces(chess.history({ verbose: true }))
  const feedback = getPositionFeedback(chess)

  useEffect(
    () => () => {
      gameVersion.current += 1
      clearTimeout(botTimer.current)
    },
    [],
  )

  const squareFromCoords = (row, col) =>
    String.fromCharCode(97 + col) + (8 - row)

  const updateScreen = () => {
    refresh((number) => number + 1)
  }

  const clearSelection = () => {
    setSelected(null)
    setLegalMoves([])
  }

  const invalidateBotMove = () => {
    gameVersion.current += 1
    clearTimeout(botTimer.current)
    botTimer.current = null
  }

  const recordMove = (move) => {
    setHistory((oldHistory) => [...oldHistory, move.san])

    const event = createCaptureEvent(move, ++battleId.current)
    if (event) setBattleEvent(event)

    updateScreen()
  }

  const selectPiece = (square) => {
    const piece = chess.get(square)

    if (!piece || piece.color !== chess.turn()) return

    setSelected(square)
    setLegalMoves(
      chess.moves({ square, verbose: true }).map((move) => move.to),
    )
  }

  const makeBotMove = async (requestVersion) => {
    if (
      requestVersion !== gameVersion.current ||
      mode !== 'bot' ||
      chess.isGameOver()
    ) {
      return
    }

    setThinking(true)

    try {
      const bestMove = await getStockfishMove(
        chess.fen(),
        depthMap[difficulty],
      )

      if (requestVersion !== gameVersion.current) return

      const result = chess.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove.length > 4 ? bestMove[4] : 'q',
      })

      if (result) recordMove(result)
    } catch (error) {
      if (requestVersion === gameVersion.current) {
        console.error('Stockfish error:', error)
      }
    } finally {
      if (requestVersion === gameVersion.current) setThinking(false)
    }
  }

  const scheduleBotMove = () => {
    const requestVersion = gameVersion.current
    botTimer.current = setTimeout(
      () => makeBotMove(requestVersion),
      100,
    )
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

    if (piece && piece.color === chess.turn() && square !== selected) {
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

      clearSelection()
      recordMove(move)

      if (mode === 'bot' && chess.turn() === 'b' && !chess.isGameOver()) {
        scheduleBotMove()
      }
    } catch (error) {
      console.warn(error)
      clearSelection()
    }
  }

  const resetGame = () => {
    invalidateBotMove()
    chess.reset()
    clearSelection()
    setHistory([])
    setBattleEvent(null)
    setThinking(false)
    updateScreen()
  }

  const changeMode = (newMode) => {
    invalidateBotMove()
    chess.reset()
    setMode(newMode)
    clearSelection()
    setHistory([])
    setBattleEvent(null)
    setThinking(false)
    updateScreen()
  }

  const status = () => {
    if (chess.isCheckmate()) {
      return `CHECKMATE — ${chess.turn() === 'w' ? 'Black' : 'White'} wins`
    }
    if (chess.isDraw()) return 'DRAW'
    if (chess.inCheck()) {
      return `${chess.turn() === 'w' ? 'White' : 'Black'} is in CHECK`
    }
    return `${chess.turn() === 'w' ? 'White' : 'Black'} to move`
  }

  return (
    <main className="game-shell">
      <h1>⚔️ BATTLE CHESS</h1>
      <p>Real chess underneath. A cinematic war game on top.</p>

      <div className="game-controls">
        <button onClick={() => changeMode('human')}>Human vs Human</button>
        <button onClick={() => changeMode('bot')}>Human vs Bot</button>
        <button onClick={resetGame}>Reset Match</button>

        {mode === 'bot' && (
          <div className="difficulty-controls" aria-label="Bot difficulty">
            {Object.keys(depthMap).map((level) => (
              <button
                aria-pressed={difficulty === level}
                key={level}
                onClick={() => setDifficulty(level)}
                style={difficultyButtonStyle(difficulty === level)}
              >
                {level[0].toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <h2 className={`game-status game-status--${feedback}`} aria-live="polite">
        {thinking ? '🤖 Bot thinking...' : status()}
      </h2>

      <BattleBanner event={battleEvent} />

      <div
        className={`chess-board chess-board--${feedback}`}
        aria-label="Chess board"
      >
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const square = squareFromCoords(rowIndex, colIndex)
            const light = (rowIndex + colIndex) % 2 === 0
            const legal = legalMoves.includes(square)
            const selectedSquare = selected === square
            const targetPiece = chess.get(square)
            const capture =
              legal &&
              targetPiece &&
              selected &&
              chess.get(selected)?.color !== targetPiece.color
            let background = light ? '#d8bd86' : '#755038'

            if (selectedSquare) background = '#d6a900'
            else if (capture) background = '#a83b3b'
            else if (legal) background = '#63895b'

            let symbol = ''
            if (piece) {
              const key =
                piece.color === 'w' ? piece.type.toUpperCase() : piece.type
              symbol = pieceSymbols[key]
            }

            const impact =
              battleEvent?.type === 'capture' && battleEvent.to === square

            return (
              <button
                aria-label={`${square.toUpperCase()}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} piece` : ''}`}
                className="board-square"
                disabled={thinking || chess.isGameOver()}
                key={square}
                onClick={() => handleClick(rowIndex, colIndex)}
                style={{ background }}
              >
                {symbol}
                {legal && !piece && <span className="legal-move-dot" />}
                {capture && <span className="capture-target" />}
                {impact && (
                  <span
                    aria-hidden="true"
                    className="battle-impact"
                    key={battleEvent.id}
                  />
                )}
              </button>
            )
          }),
        )}
      </div>

      <CapturedPieces captured={captured} />

      <section className="match-details">
        <strong>Selected:</strong> {selected ? selected.toUpperCase() : 'None'}
        <h3>Move History</h3>
        <p>{history.length ? history.join('  ') : 'No moves yet'}</p>
      </section>
    </main>
  )
}

function difficultyButtonStyle(active) {
  return {
    border: active
      ? '2px solid #ffd45a'
      : '1px solid rgba(255,255,255,0.25)',
    borderRadius: 8,
    padding: '8px 14px',
    background: active ? '#685312' : 'rgba(255,255,255,0.08)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 700,
  }
}
