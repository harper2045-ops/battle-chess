export const TIME_CONTROLS = [
  { id: 'untimed', label: 'Untimed', initialMs: null, incrementMs: 0 },
  { id: '1+0', label: '1+0', initialMs: 60_000, incrementMs: 0 },
  { id: '3+2', label: '3+2', initialMs: 180_000, incrementMs: 2_000 },
  { id: '5+0', label: '5+0', initialMs: 300_000, incrementMs: 0 },
  { id: '10+0', label: '10+0', initialMs: 600_000, incrementMs: 0 },
]

const controlsById = Object.fromEntries(
  TIME_CONTROLS.map((control) => [control.id, control]),
)

function cloneState(state) {
  return {
    ...state,
    remainingMs: { ...state.remainingMs },
  }
}

export function createClockController(
  initialControlId = 'untimed',
  now = () => Date.now(),
) {
  let state
  let lastTimestamp = null
  let timeline = []
  let redoTurns = []

  function snapshot() {
    return cloneState(state)
  }

  function sync(timestamp = now()) {
    if (!state.running || !state.activeColor || state.timedOutColor) {
      return
    }

    const elapsed = Math.max(0, timestamp - lastTimestamp)
    const color = state.activeColor
    state.remainingMs[color] = Math.max(
      0,
      state.remainingMs[color] - elapsed,
    )
    lastTimestamp = timestamp

    if (state.remainingMs[color] === 0) {
      state.running = false
      state.activeColor = null
      state.timedOutColor = color
      lastTimestamp = null
    }
  }

  function restore(savedState) {
    state = cloneState(savedState)
    lastTimestamp = state.running ? now() : null
  }

  function reset(controlId = initialControlId, startingColor = 'w') {
    const control = controlsById[controlId]
    if (!control) throw new Error(`Unknown time control: ${controlId}`)

    const enabled = control.initialMs !== null
    state = {
      controlId,
      enabled,
      incrementMs: control.incrementMs,
      remainingMs: {
        w: control.initialMs,
        b: control.initialMs,
      },
      activeColor: enabled ? startingColor : null,
      running: enabled,
      timedOutColor: null,
    }
    lastTimestamp = enabled ? now() : null
    timeline = [snapshot()]
    redoTurns = []
    return snapshot()
  }

  reset(initialControlId)

  return {
    reset,

    getState() {
      sync()
      return snapshot()
    },

    completeMove(movingColor, nextColor, gameOver = false) {
      const timestamp = now()
      sync(timestamp)
      if (state.timedOutColor) return snapshot()

      if (state.enabled) {
        state.remainingMs[movingColor] += state.incrementMs
        state.activeColor = gameOver ? null : nextColor
        state.running = !gameOver
        lastTimestamp = state.running ? timestamp : null
      }

      timeline.push(snapshot())
      redoTurns = []
      return snapshot()
    },

    finish() {
      sync()
      state.running = false
      state.activeColor = null
      lastTimestamp = null
      return snapshot()
    },

    pause() {
      sync()
      state.running = false
      lastTimestamp = null
      return snapshot()
    },

    resume() {
      if (state.enabled && state.activeColor && !state.timedOutColor) {
        state.running = true
        lastTimestamp = now()
      }
      return snapshot()
    },

    undo(moveCount) {
      sync()
      const removable = Math.min(moveCount, timeline.length - 1)
      if (removable <= 0) return snapshot()

      const removed = timeline.splice(timeline.length - removable, removable)
      redoTurns.push(removed)
      restore(timeline.at(-1))
      return snapshot()
    },

    redo() {
      const restored = redoTurns.pop()
      if (!restored) return snapshot()

      timeline.push(...restored.map(cloneState))
      restore(timeline.at(-1))
      return snapshot()
    },
  }
}

/** Remaining under this threshold shows tenths (0:09.4). */
export const CLOCK_TENTHS_MS = 10_000

/** Active clock under this threshold gets a low-time visual warning. */
export const CLOCK_LOW_MS = 30_000

export function isLowTime(remainingMs) {
  return (
    typeof remainingMs === 'number' &&
    remainingMs > 0 &&
    remainingMs < CLOCK_LOW_MS
  )
}

export function formatClock(remainingMs) {
  if (remainingMs === null) return '--:--'

  const ms = Math.max(0, remainingMs)

  // Under 10s: show tenths so flagging is readable (lichess-style).
  if (ms < CLOCK_TENTHS_MS) {
    const tenthsTotal = Math.floor(ms / 100)
    const seconds = Math.floor(tenthsTotal / 10)
    const tenths = tenthsTotal % 10
    return `0:${String(seconds).padStart(2, '0')}.${tenths}`
  }

  // Whole seconds use ceil so displayed time never under-reads remaining.
  const totalSeconds = Math.ceil(ms / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
