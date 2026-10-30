/**
 * Persist match preferences (mode / difficulty / side) in localStorage.
 * Presentation-only — never affects chess.js legality or outcomes.
 */

export const SETTINGS_STORAGE_KEY = 'battle-chess-settings'

export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'human',
  difficulty: 'medium',
  playerColor: 'w',
  battles: 'full',
})

export const SETTINGS_BATTLES = Object.freeze(['full', 'short', 'off'])

export const SETTINGS_MODES = Object.freeze(['human', 'bot'])
export const SETTINGS_DIFFICULTIES = Object.freeze([
  'easy',
  'medium',
  'hard',
])
export const SETTINGS_PLAYER_COLORS = Object.freeze(['w', 'b'])

/**
 * Coerce a partial/unknown payload into a safe settings object.
 * @param {unknown} raw
 * @param {boolean} reducedMotion
 */
export function normalizeSettings(raw, reducedMotion = false) {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const defaultBattles = reducedMotion ? 'off' : DEFAULT_SETTINGS.battles

  return {
    mode: SETTINGS_MODES.includes(source.mode)
      ? source.mode
      : DEFAULT_SETTINGS.mode,
    difficulty: SETTINGS_DIFFICULTIES.includes(source.difficulty)
      ? source.difficulty
      : DEFAULT_SETTINGS.difficulty,
    playerColor: SETTINGS_PLAYER_COLORS.includes(source.playerColor)
      ? source.playerColor
      : DEFAULT_SETTINGS.playerColor,
    battles: SETTINGS_BATTLES.includes(source.battles)
      ? source.battles
      : defaultBattles,
  }
}

/**
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @param {boolean} reducedMotion
 */
export function readSettings(storage, reducedMotion = false) {
  try {
    const raw = storage?.getItem?.(SETTINGS_STORAGE_KEY)
    if (!raw) return normalizeSettings({}, reducedMotion)
    return normalizeSettings(JSON.parse(raw), reducedMotion)
  } catch {
    return normalizeSettings({}, reducedMotion)
  }
}

/**
 * @param {Pick<Storage, 'setItem'> | null | undefined} storage
 * @param {unknown} settings
 */
export function writeSettings(storage, settings) {
  const next = normalizeSettings(settings)
  try {
    storage?.setItem?.(SETTINGS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode / blocked storage — preference stays in-memory only.
  }
  return next
}

/** Default browser localStorage when available (SSR / tests may pass null). */
export function defaultSettingsStorage() {
  try {
    return typeof globalThis.localStorage !== 'undefined'
      ? globalThis.localStorage
      : null
  } catch {
    return null
  }
}
