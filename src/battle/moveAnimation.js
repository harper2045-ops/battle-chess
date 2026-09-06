import { squareToWorld } from './captureAnimation.js'

/** Base quiet-move slide (ms); distance adds more so long marches feel longer. */
export const quietMoveBaseMs = 380
export const quietMovePerSquareMs = 140

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Chebyshev steps for sliders; euclidean for knights so jumps aren't too slow. */
export function quietMoveDistance(from, to) {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0))
  const dr = Math.abs(Number(from[1]) - Number(to[1]))
  if (df > 0 && dr > 0 && df !== dr) {
    // Knight (or other non-diagonal/orthogonal) — use hypot.
    return Math.hypot(df, dr)
  }
  return Math.max(df, dr, 1)
}

export function quietMoveDuration(from, to, reducedMotion = false) {
  if (reducedMotion) return 80
  return quietMoveBaseMs + quietMoveDistance(from, to) * quietMovePerSquareMs
}

export function getQuietMoveAction(progress, reducedMotion = false) {
  if (reducedMotion) return 'idle'
  const t = Math.max(0, Math.min(1, progress))
  // Brief idle settle on arrival so the LoopRepeat walk doesn't freeze mid-stride.
  if (t >= 0.97) return 'idle'
  return 'walk'
}

/**
 * World-space pose for a quiet march. Knights get a small hop; sliders stay grounded.
 */
export function getQuietMovePose(event, progress) {
  const t = Math.max(0, Math.min(1, progress))
  const eased = easeInOutCubic(t)
  const from = squareToWorld(event.from)
  const to = squareToWorld(event.to)
  const df = Math.abs(event.from.charCodeAt(0) - event.to.charCodeAt(0))
  const dr = Math.abs(Number(event.from[1]) - Number(event.to[1]))
  const isKnight = df > 0 && dr > 0 && df !== dr
  const hop = isKnight ? Math.sin(eased * Math.PI) * 0.42 : 0

  return [
    from[0] + (to[0] - from[0]) * eased,
    hop,
    from[2] + (to[2] - from[2]) * eased,
  ]
}
