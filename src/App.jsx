import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Chess } from 'chess.js'
import {
  createCaptureEvent,
  createQuietMoveEvent,
  getCapturedPieces,
  getPositionFeedback,
} from './battle/battleEvents.js'
import {
  BattleBanner,
  CapturedPieces,
} from './components/BattlePresentation.jsx'
import { ChessBoard3D } from './components/ChessBoard3D.jsx'
import {
  ChessClocks,
  TimeControlPicker,
} from './components/ChessClocks.jsx'
import {
  cancelStockfishMove,
  getStockfishMove,
} from './engine/stockfishEngine.js'
import {
  createBotRequestGuard,
  createHistoryController,
} from './game/history.js'
import { getOrientedBoard } from './game/board.js'
import { copyPgn, createPgnFilename, getGamePgn } from './game/pgn.js'
import { isBotTurn } from './game/player.js'
import { createClockController } from './game/clock.js'
import { useGameClock } from './hooks/useGameClock.js'
import { CreditsPanel } from './components/CreditsPanel.jsx'
import { BotThinking } from './components/BotThinking.jsx'
import { PromotionPicker } from './components/PromotionPicker.jsx'
import { getPromotionOptions } from './game/promotion.js'
import { clearedPresentationState } from './game/presentation.js'
import {
  resolveKeyboardShortcut,
  shortcutHintLabel,
  SHORTCUT_ACTIONS,
} from './game/keyboardShortcuts.js'

const depthMap = {
  easy: 5,
  medium: 10,
  hard: 15,
}

export default function App() {
  const chess = useMemo(() => new Chess(), [])
  const historyController = useMemo(
    () => createHistoryController(chess),
    [chess],
  )
  const botRequestGuard = useMemo(() => createBotRequestGuard(), [])
  const clockController = useMemo(() => createClockController(), [])
  const botTimer = useRef(null)
  const modeRef = useRef('human')
  const playerColorRef = useRef('w')
  const battleId = useRef(0)
  const [, refresh] = useState(0)
  const [difficulty, setDifficulty] = useState('medium')
  const [selected, setSelected] = useState(null)
  const [legalMoves, setLegalMoves] = useState([])
  const [mode, setMode] = useState('human')
  const [orientation, setOrientation] = useState('w')
  const [playerColor, setPlayerColor] = useState('w')
  const [thinking, setThinking] = useState(false)
  const [battleEvent, setBattleEvent] = useState(null)
  const [activeCapture, setActiveCapture] = useState(null)
  const [activeMove, setActiveMove] = useState(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [timeControl, setTimeControl] = useState('untimed')
  const [pendingPromotion, setPendingPromotion] = useState(null)

  const clearSelection = useCallback(() => {
    setSelected(null)
    setLegalMoves([])
  }, [])

  // Shared reset for selection + in-flight battle/move presentation so
  // undo/reset/mode changes/timeout never leave desynced animated pieces.
  const clearPresentationState = useCallback(() => {
    const cleared = clearedPresentationState()
    setSelected(cleared.selected)
    setLegalMoves(cleared.legalMoves)
    setBattleEvent(cleared.battleEvent)
    setActiveCapture(cleared.activeCapture)
    setActiveMove(cleared.activeMove)
    setCopyStatus(cleared.copyStatus)
    setThinking(cleared.thinking)
    setPendingPromotion(null)
  }, [])

  const invalidateBotMove = useCallback(() => {
    botRequestGuard.invalidate()
    clearTimeout(botTimer.current)
    botTimer.current = null
    cancelStockfishMove()
  }, [botRequestGuard])

  const onClockTimeout = useCallback(() => {
    invalidateBotMove()
    clearPresentationState()
  }, [clearPresentationState, invalidateBotMove])

  const {
    clockState,
    matchResult,
    refreshClock,
    resetClock: resetGameClock,
    clearMatchResult,
    setClockState,
  } = useGameClock(clockController, { onTimeout: onClockTimeout })

  const board = getOrientedBoard(chess.board(), orientation)
  const captured = getCapturedPieces(chess.history({ verbose: true }))
  const history = chess.history()
  const feedback = getPositionFeedback(chess)
  const matchFeedback = matchResult ? 'timeout' : feedback

  useEffect(
    () => () => {
      botRequestGuard.invalidate()
      clearTimeout(botTimer.current)
      cancelStockfishMove()
    },
    [botRequestGuard],
  )

  // Keep latest handlers without re-binding the window listener every render.
  const shortcutHandlersRef = useRef({
    undo: () => {},
    redo: () => {},
    flip: () => {},
    clearSelection: () => {},
    hasSelection: false,
    modalOpen: false,
  })

  useEffect(() => {
    const onKeyDown = (event) => {
      const handlers = shortcutHandlersRef.current
      const action = resolveKeyboardShortcut(event, {
        hasSelection: handlers.hasSelection,
        modalOpen: handlers.modalOpen,
        root: document,
      })
      if (!action) return

      event.preventDefault()
      if (action === SHORTCUT_ACTIONS.undo) handlers.undo()
      else if (action === SHORTCUT_ACTIONS.redo) handlers.redo()
      else if (action === SHORTCUT_ACTIONS.flip) handlers.flip()
      else if (action === SHORTCUT_ACTIONS.clearSelection) {
        handlers.clearSelection()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const updateScreen = () => {
    refresh((number) => number + 1)
  }

  const resetClock = (controlId = timeControl) => {
    resetGameClock(controlId)
  }

  const recordMove = (move) => {
    historyController.recordMove()
    setCopyStatus('')

    const nextClockState = clockController.completeMove(
      move.color,
      chess.turn(),
      chess.isGameOver(),
    )
    setClockState(nextClockState)

    const id = ++battleId.current
    const capture = createCaptureEvent(move, id)
    if (capture) {
      setBattleEvent(capture)
      setActiveCapture(capture)
      setActiveMove(null)
    } else {
      const quiet = createQuietMoveEvent(move, id)
      setActiveCapture(null)
      setActiveMove(quiet)
    }

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
      !botRequestGuard.isCurrent(requestVersion) ||
      !isBotTurn(
        modeRef.current,
        playerColorRef.current,
        chess.turn(),
      ) ||
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

      const currentClock = refreshClock()
      if (
        currentClock.timedOutColor ||
        !botRequestGuard.isCurrent(requestVersion)
      ) {
        return
      }

      const result = chess.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove.length > 4 ? bestMove[4] : 'q',
      })

      if (result) recordMove(result)
    } catch (error) {
      if (botRequestGuard.isCurrent(requestVersion)) {
        console.error('Stockfish error:', error)
      }
    } finally {
      if (botRequestGuard.isCurrent(requestVersion)) setThinking(false)
    }
  }

  const scheduleBotMove = () => {
    const requestVersion = botRequestGuard.capture()
    botTimer.current = setTimeout(
      () => makeBotMove(requestVersion),
      100,
    )
  }

  const commitPlayerMove = (from, to, promotion) => {
    try {
      const move = chess.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      })

      if (!move) {
        clearSelection()
        setPendingPromotion(null)
        return
      }

      clearSelection()
      setPendingPromotion(null)
      recordMove(move)

      if (
        isBotTurn(mode, playerColor, chess.turn()) &&
        !chess.isGameOver()
      ) {
        scheduleBotMove()
      }
    } catch (error) {
      console.warn(error)
      clearSelection()
      setPendingPromotion(null)
    }
  }

  const handleClick = (square) => {
    if (
      thinking ||
      chess.isGameOver() ||
      matchResult ||
      pendingPromotion
    ) {
      return
    }

    if (refreshClock().timedOutColor) return

    const piece = chess.get(square)

    if (!selected) {
      if (isBotTurn(mode, playerColor, chess.turn())) return
      selectPiece(square)
      return
    }

    if (piece && piece.color === chess.turn() && square !== selected) {
      selectPiece(square)
      return
    }

    const promotionOptions = getPromotionOptions(chess, selected, square)
    if (promotionOptions) {
      setPendingPromotion({
        from: selected,
        to: square,
        color: chess.turn(),
        options: promotionOptions,
      })
      return
    }

    commitPlayerMove(selected, square)
  }

  const choosePromotion = (promotion) => {
    if (!pendingPromotion) return
    commitPlayerMove(
      pendingPromotion.from,
      pendingPromotion.to,
      promotion,
    )
  }

  const cancelPromotion = () => {
    if (!pendingPromotion) return
    const from = pendingPromotion.from
    setPendingPromotion(null)
    selectPiece(from)
  }

  const resetGame = () => {
    invalidateBotMove()
    chess.reset()
    historyController.clear()
    clearPresentationState()
    resetClock()
    updateScreen()

    if (
      isBotTurn(
        modeRef.current,
        playerColorRef.current,
        chess.turn(),
      )
    ) {
      scheduleBotMove()
    }
  }

  const changeMode = (newMode) => {
    invalidateBotMove()
    chess.reset()
    historyController.clear()
    modeRef.current = newMode
    setMode(newMode)
    clearPresentationState()
    resetClock()
    updateScreen()

    if (isBotTurn(newMode, playerColorRef.current, chess.turn())) {
      scheduleBotMove()
    }
  }

  const changePlayerColor = (color) => {
    invalidateBotMove()
    chess.reset()
    historyController.clear()
    playerColorRef.current = color
    setPlayerColor(color)
    setOrientation(color)
    clearPresentationState()
    resetClock()
    updateScreen()

    if (isBotTurn(modeRef.current, color, chess.turn())) scheduleBotMove()
  }

  const prepareHistoryChange = () => {
    invalidateBotMove()
    clearPresentationState()
    clearMatchResult()
  }

  const undoMove = () => {
    if (!historyController.canUndo(mode, playerColor)) return

    prepareHistoryChange()
    const undoneMoves = historyController.undo(mode, playerColor)
    setClockState(clockController.undo(undoneMoves))
    updateScreen()
  }

  const redoMove = () => {
    if (!historyController.canRedo()) return

    prepareHistoryChange()
    const redoneMoves = historyController.redo()
    setClockState(clockController.redo())
    updateScreen()

    if (
      redoneMoves.length === 1 &&
      isBotTurn(mode, playerColor, chess.turn()) &&
      !chess.isGameOver()
    ) {
      scheduleBotMove()
    }
  }

  shortcutHandlersRef.current = {
    undo: undoMove,
    redo: redoMove,
    flip: () => setOrientation((current) => (current === 'w' ? 'b' : 'w')),
    clearSelection,
    hasSelection: Boolean(selected),
    modalOpen: Boolean(pendingPromotion),
  }

  const changeTimeControl = (controlId) => {
    invalidateBotMove()
    chess.reset()
    historyController.clear()
    setTimeControl(controlId)
    clearPresentationState()
    resetClock(controlId)
    updateScreen()

    if (
      isBotTurn(
        modeRef.current,
        playerColorRef.current,
        chess.turn(),
      )
    ) {
      scheduleBotMove()
    }
  }

  const copyGamePgn = async () => {
    try {
      await copyPgn(getGamePgn(chess), navigator.clipboard)
      setCopyStatus('PGN copied')
    } catch {
      setCopyStatus('Unable to copy PGN')
    }
  }

  const downloadGamePgn = () => {
    const pgn = getGamePgn(chess)
    if (!pgn) return

    const url = URL.createObjectURL(
      new Blob([pgn], { type: 'application/x-chess-pgn' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = createPgnFilename()
    link.click()
    URL.revokeObjectURL(url)
  }

  const completeCapture = useCallback((eventId) => {
    setActiveCapture((current) =>
      current?.id === eventId ? null : current,
    )
  }, [])

  const completeMove = useCallback((eventId) => {
    setActiveMove((current) =>
      current?.id === eventId ? null : current,
    )
  }, [])

  const status = () => {
    if (matchResult?.type === 'timeout') {
      return `${matchResult.winner === 'w' ? 'White' : 'Black'} wins on TIME`
    }
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
      <p className="visually-hidden">
        Keyboard shortcuts: {shortcutHintLabel(SHORTCUT_ACTIONS.undo)} undo,{' '}
        {shortcutHintLabel(SHORTCUT_ACTIONS.redo)} redo,{' '}
        {shortcutHintLabel(SHORTCUT_ACTIONS.flip)} flip board,{' '}
        {shortcutHintLabel(SHORTCUT_ACTIONS.clearSelection)} clear selection.
      </p>

      <div className="game-controls">
        <button onClick={() => changeMode('human')}>Human vs Human</button>
        <button onClick={() => changeMode('bot')}>Human vs Bot</button>
        <button onClick={resetGame}>Reset Match</button>
        <button
          aria-keyshortcuts="Control+Z Meta+Z"
          disabled={!historyController.canUndo(mode, playerColor)}
          onClick={undoMove}
          title={`Undo (${shortcutHintLabel(SHORTCUT_ACTIONS.undo)})`}
        >
          Undo
        </button>
        <button
          aria-keyshortcuts="Control+Y Meta+Y Control+Shift+Z Meta+Shift+Z"
          disabled={!historyController.canRedo()}
          onClick={redoMove}
          title={`Redo (${shortcutHintLabel(SHORTCUT_ACTIONS.redo)})`}
        >
          Redo
        </button>
        <button
          aria-keyshortcuts="F"
          aria-label={`Show ${orientation === 'w' ? 'Black' : 'White'} at the bottom`}
          onClick={() => setOrientation(orientation === 'w' ? 'b' : 'w')}
          title={`Flip board (${shortcutHintLabel(SHORTCUT_ACTIONS.flip)})`}
        >
          Flip Board
        </button>

        {mode === 'bot' && (
          <div className="bot-options">
            <div className="color-controls" aria-label="Choose your color">
              <span>You play:</span>
              <button
                aria-pressed={playerColor === 'w'}
                onClick={() => changePlayerColor('w')}
              >
                White
              </button>
              <button
                aria-pressed={playerColor === 'b'}
                onClick={() => changePlayerColor('b')}
              >
                Black
              </button>
            </div>
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
          </div>
        )}
      </div>

      <TimeControlPicker
        onChange={changeTimeControl}
        selected={timeControl}
      />

      <div className="export-controls" aria-label="Export game">
        <button disabled={!history.length} onClick={copyGamePgn}>
          Copy PGN
        </button>
        <button disabled={!history.length} onClick={downloadGamePgn}>
          Download PGN
        </button>
        <span aria-live="polite">{copyStatus}</span>
      </div>

      <CreditsPanel />

      <h2
        className={`game-status game-status--${matchFeedback}`}
        aria-busy={thinking}
        aria-live="polite"
      >
        {status()}
      </h2>

      <BotThinking active={thinking} difficulty={difficulty} />

      <BattleBanner event={battleEvent} />

      <ChessClocks orientation={orientation} state={clockState} />

      {pendingPromotion ? (
        <PromotionPicker
          color={pendingPromotion.color}
          onCancel={cancelPromotion}
          onChoose={choosePromotion}
          options={pendingPromotion.options}
        />
      ) : null}

      <ChessBoard3D
        board={board}
        orientation={orientation}
        selected={selected}
        legalMoves={legalMoves}
        activeCapture={activeCapture}
        activeMove={activeMove}
        disabled={
          thinking ||
          chess.isGameOver() ||
          Boolean(matchResult) ||
          Boolean(pendingPromotion)
        }
        feedback={matchFeedback}
        onSquareClick={handleClick}
        onCaptureComplete={completeCapture}
        onMoveComplete={completeMove}
      />

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
