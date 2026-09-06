import { describe, expect, it, vi } from 'vitest'
import {
  SOUND_KINDS,
  SOUND_STORAGE_KEY,
  createSoundController,
  readMuted,
  resolveMoveSound,
  writeMuted,
} from './sound.js'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
  }
}

function mockAudioContext() {
  const oscillators = []
  const gains = []

  return {
    state: 'running',
    currentTime: 0,
    resume: vi.fn(async () => {}),
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(osc)
      return osc
    },
    createGain() {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
      gains.push(gain)
      return gain
    },
    oscillators,
    gains,
  }
}

describe('resolveMoveSound', () => {
  it('prefers game-over cues for mate and draws', () => {
    expect(
      resolveMoveSound({ feedback: 'checkmate', captured: true }),
    ).toBe(SOUND_KINDS.gameOver)
    expect(resolveMoveSound({ isDraw: true })).toBe(SOUND_KINDS.gameOver)
  })

  it('uses check over capture, capture over quiet move', () => {
    expect(
      resolveMoveSound({ feedback: 'check', captured: true }),
    ).toBe(SOUND_KINDS.check)
    expect(resolveMoveSound({ captured: true })).toBe(SOUND_KINDS.capture)
    expect(resolveMoveSound({})).toBe(SOUND_KINDS.move)
  })
})

describe('mute persistence', () => {
  it('reads and writes the muted flag', () => {
    const storage = memoryStorage()
    expect(readMuted(storage)).toBe(false)

    writeMuted(storage, true)
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe('1')
    expect(readMuted(storage)).toBe(true)

    writeMuted(storage, false)
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe('0')
    expect(readMuted(storage)).toBe(false)
  })

  it('survives storage throwing (private mode)', () => {
    const broken = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    expect(readMuted(broken)).toBe(false)
    expect(() => writeMuted(broken, true)).not.toThrow()
  })
})

describe('createSoundController', () => {
  it('loads muted preference and toggles with persistence', () => {
    const storage = memoryStorage({ [SOUND_STORAGE_KEY]: '1' })
    const sound = createSoundController({
      storage,
      createContext: () => mockAudioContext(),
    })

    expect(sound.isMuted()).toBe(true)
    expect(sound.toggleMuted()).toBe(false)
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe('0')
    expect(sound.setMuted(true)).toBe(true)
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe('1')
  })

  it('does not schedule audio while muted', () => {
    const ctx = mockAudioContext()
    const sound = createSoundController({
      storage: memoryStorage(),
      createContext: () => ctx,
    })
    sound.setMuted(true)

    expect(sound.play(SOUND_KINDS.move)).toBe(false)
    expect(ctx.oscillators).toHaveLength(0)
  })

  it('plays move and capture recipes when unmuted', () => {
    const ctx = mockAudioContext()
    const sound = createSoundController({
      storage: memoryStorage(),
      createContext: () => ctx,
    })

    expect(sound.play(SOUND_KINDS.move)).toBe(true)
    expect(ctx.oscillators.length).toBeGreaterThanOrEqual(1)

    const before = ctx.oscillators.length
    expect(sound.play(SOUND_KINDS.capture)).toBe(true)
    expect(ctx.oscillators.length).toBeGreaterThan(before)
  })

  it('returns false for unknown kinds and missing AudioContext', () => {
    const sound = createSoundController({
      storage: memoryStorage(),
      createContext: () => null,
    })
    expect(sound.play(SOUND_KINDS.move)).toBe(false)
    expect(sound.play('fanfare')).toBe(false)
  })
})
