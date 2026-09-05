import { useCallback, useEffect, useRef, useState } from 'react'

export function useGameClock(clockController, { onTimeout } = {}) {
  const timeoutResultRef = useRef(null)
  const [clockState, setClockState] = useState(() =>
    clockController.getState(),
  )
  const [matchResult, setMatchResult] = useState(null)

  const endByTimeout = useCallback(
    (state) => {
      if (!state.timedOutColor || timeoutResultRef.current) return

      const result = {
        type: 'timeout',
        loser: state.timedOutColor,
        winner: state.timedOutColor === 'w' ? 'b' : 'w',
      }
      timeoutResultRef.current = result
      setMatchResult(result)
      onTimeout?.()
    },
    [onTimeout],
  )

  const refreshClock = useCallback(() => {
    const state = clockController.getState()
    setClockState(state)
    endByTimeout(state)
    return state
  }, [clockController, endByTimeout])

  useEffect(() => {
    if (!clockState.running) return undefined

    const interval = setInterval(refreshClock, 100)
    document.addEventListener('visibilitychange', refreshClock)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshClock)
    }
  }, [clockState.running, refreshClock])

  const resetClock = useCallback(
    (controlId, startingColor = 'w') => {
      timeoutResultRef.current = null
      setMatchResult(null)
      setClockState(clockController.reset(controlId, startingColor))
    },
    [clockController],
  )

  const clearMatchResult = useCallback(() => {
    timeoutResultRef.current = null
    setMatchResult(null)
  }, [])

  return {
    clockState,
    matchResult,
    refreshClock,
    resetClock,
    clearMatchResult,
    setClockState,
  }
}
