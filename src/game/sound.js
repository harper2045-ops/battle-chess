/**
 * Procedural battle SFX via Web Audio — no asset files.
 * Mute preference persists in localStorage; presentation never affects chess.
 */

export const SOUND_STORAGE_KEY = 'battle-chess-sound-muted'

export const SOUND_KINDS = Object.freeze({
  move: 'move',
  capture: 'capture',
  check: 'check',
  gameOver: 'gameOver',
})

export function readMuted(storage) {
  try {
    return storage?.getItem?.(SOUND_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMuted(storage, muted) {
  try {
    storage?.setItem?.(SOUND_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Private mode / blocked storage — preference stays in-memory only.
  }
}

/**
 * Pick the highest-priority cue for a completed ply.
 * Checkmate / draw beat check; check beats capture; else quiet move.
 */
export function resolveMoveSound({
  captured = false,
  feedback = 'normal',
  isDraw = false,
} = {}) {
  if (feedback === 'checkmate' || isDraw) return SOUND_KINDS.gameOver
  if (feedback === 'check') return SOUND_KINDS.check
  if (captured) return SOUND_KINDS.capture
  return SOUND_KINDS.move
}

function defaultCreateContext() {
  if (typeof globalThis.AudioContext === 'function') {
    return new globalThis.AudioContext()
  }
  if (typeof globalThis.webkitAudioContext === 'function') {
    return new globalThis.webkitAudioContext()
  }
  return null
}

function scheduleTone(audio, {
  frequency,
  start = 0,
  duration = 0.1,
  type = 'sine',
  gain = 0.06,
}) {
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = type
  osc.frequency.value = frequency
  const t0 = audio.currentTime + start
  amp.gain.setValueAtTime(Math.max(gain, 0.0001), t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(amp)
  amp.connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

const RECIPES = {
  [SOUND_KINDS.move]: (audio) => {
    scheduleTone(audio, {
      frequency: 520,
      duration: 0.07,
      type: 'triangle',
      gain: 0.045,
    })
  },
  [SOUND_KINDS.capture]: (audio) => {
    scheduleTone(audio, {
      frequency: 180,
      duration: 0.11,
      type: 'sawtooth',
      gain: 0.055,
    })
    scheduleTone(audio, {
      frequency: 120,
      start: 0.05,
      duration: 0.14,
      type: 'square',
      gain: 0.035,
    })
  },
  [SOUND_KINDS.check]: (audio) => {
    scheduleTone(audio, {
      frequency: 660,
      duration: 0.09,
      type: 'square',
      gain: 0.05,
    })
    scheduleTone(audio, {
      frequency: 880,
      start: 0.1,
      duration: 0.11,
      type: 'square',
      gain: 0.045,
    })
  },
  [SOUND_KINDS.gameOver]: (audio) => {
    scheduleTone(audio, {
      frequency: 392,
      duration: 0.16,
      type: 'sine',
      gain: 0.055,
    })
    scheduleTone(audio, {
      frequency: 311,
      start: 0.15,
      duration: 0.2,
      type: 'sine',
      gain: 0.05,
    })
    scheduleTone(audio, {
      frequency: 220,
      start: 0.34,
      duration: 0.32,
      type: 'triangle',
      gain: 0.045,
    })
  },
}

/**
 * @param {{
 *   storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
 *   createContext?: () => (AudioContext | null),
 * }} [options]
 */
export function createSoundController(options = {}) {
  const {
    storage =
      typeof globalThis.localStorage !== 'undefined'
        ? globalThis.localStorage
        : null,
    createContext = defaultCreateContext,
  } = options

  let muted = readMuted(storage)
  let ctx = null

  const ensureContext = () => {
    if (!ctx) {
      try {
        ctx = createContext()
      } catch {
        ctx = null
      }
    }
    if (ctx?.state === 'suspended') {
      // Browsers require a user gesture; resume is best-effort.
      void ctx.resume?.().catch(() => {})
    }
    return ctx
  }

  return {
    isMuted() {
      return muted
    },
    setMuted(next) {
      muted = Boolean(next)
      writeMuted(storage, muted)
      return muted
    },
    toggleMuted() {
      return this.setMuted(!muted)
    },
    /** @param {keyof typeof SOUND_KINDS | string} kind */
    play(kind) {
      if (muted) return false
      const recipe = RECIPES[kind]
      if (!recipe) return false
      const audio = ensureContext()
      if (!audio) return false
      try {
        recipe(audio)
        return true
      } catch {
        return false
      }
    },
  }
}
