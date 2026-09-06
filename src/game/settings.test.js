import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  normalizeSettings,
  readSettings,
  writeSettings,
} from './settings.js'

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

describe('normalizeSettings', () => {
  it('returns defaults for empty or invalid input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('nope')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps known values and replaces unknowns', () => {
    expect(
      normalizeSettings({
        mode: 'bot',
        difficulty: 'hard',
        playerColor: 'b',
        extra: true,
      }),
    ).toEqual({
      mode: 'bot',
      difficulty: 'hard',
      playerColor: 'b',
    })

    expect(
      normalizeSettings({
        mode: 'lan',
        difficulty: 'nightmare',
        playerColor: 'x',
      }),
    ).toEqual(DEFAULT_SETTINGS)
  })
})

describe('settings persistence', () => {
  it('reads defaults when storage is empty', () => {
    expect(readSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS)
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips valid settings', () => {
    const storage = memoryStorage()
    const saved = writeSettings(storage, {
      mode: 'bot',
      difficulty: 'easy',
      playerColor: 'b',
    })

    expect(saved).toEqual({
      mode: 'bot',
      difficulty: 'easy',
      playerColor: 'b',
    })
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY))).toEqual(saved)
    expect(readSettings(storage)).toEqual(saved)
  })

  it('ignores corrupt JSON and storage errors', () => {
    const corrupt = memoryStorage({ [SETTINGS_STORAGE_KEY]: '{not-json' })
    expect(readSettings(corrupt)).toEqual(DEFAULT_SETTINGS)

    const broken = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    expect(readSettings(broken)).toEqual(DEFAULT_SETTINGS)
    expect(() =>
      writeSettings(broken, { mode: 'bot', difficulty: 'hard' }),
    ).not.toThrow()
  })
})
