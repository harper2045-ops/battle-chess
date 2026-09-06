/**
 * Touch / pointer helpers for the 3D board.
 * Presentation-only — never affects chess.js legality or outcomes.
 *
 * On coarse pointers (phones / tablets), one-finger gestures are reserved
 * for square taps; two-finger drag orbits and zooms. Fine pointers keep
 * the classic mouse-drag orbit.
 *
 * TOUCH enum values mirror three.js so this module stays free of a Three
 * import and stays easy to unit-test.
 */

/** @see THREE.TOUCH */
export const ORBIT_TOUCH = Object.freeze({
  ROTATE: 0,
  PAN: 1,
  DOLLY_PAN: 2,
  DOLLY_ROTATE: 3,
})

/** Default square hit-box height (world units). */
export const SQUARE_HIT_HEIGHT = 0.12

/** Taller hit-box for coarse pointers so fat-finger taps land more often. */
export const SQUARE_HIT_HEIGHT_COARSE = 0.42

/**
 * True when the environment prefers a coarse (touch-first) pointer.
 * Accepts a MediaQueryList-like, a boolean, or a matchMedia function.
 *
 * @param {MediaQueryList | boolean | ((query: string) => MediaQueryList | boolean) | null | undefined} source
 */
export function prefersCoarsePointer(source) {
  if (typeof source === 'boolean') return source

  if (source && typeof source === 'object' && 'matches' in source) {
    return Boolean(source.matches)
  }

  if (typeof source === 'function') {
    try {
      const result = source('(pointer: coarse)')
      if (typeof result === 'boolean') return result
      return Boolean(result?.matches)
    } catch {
      return false
    }
  }

  return false
}

/**
 * Resolve coarse-pointer preference from a window-like host.
 * @param {{ matchMedia?: (query: string) => MediaQueryList } | null | undefined} host
 */
export function detectCoarsePointer(host = globalThis) {
  try {
    if (typeof host?.matchMedia !== 'function') return false
    return prefersCoarsePointer(host.matchMedia.bind(host))
  } catch {
    return false
  }
}

/**
 * OrbitControls `touches` map for the given pointer class.
 * Coarse: ONE finger does not start an orbit (tap selects); TWO = orbit+zoom.
 * Fine: classic ONE = rotate, TWO = dolly+pan.
 *
 * @param {boolean} coarsePointer
 * @returns {{ ONE: number | null, TWO: number }}
 */
export function getOrbitTouches(coarsePointer) {
  if (coarsePointer) {
    return {
      ONE: null,
      TWO: ORBIT_TOUCH.DOLLY_ROTATE,
    }
  }

  return {
    ONE: ORBIT_TOUCH.ROTATE,
    TWO: ORBIT_TOUCH.DOLLY_PAN,
  }
}

/**
 * World-space height for the invisible / visible square pick mesh.
 * @param {boolean} coarsePointer
 */
export function getSquareHitHeight(coarsePointer) {
  return coarsePointer ? SQUARE_HIT_HEIGHT_COARSE : SQUARE_HIT_HEIGHT
}
