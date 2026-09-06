/** Standard chess material values (pawn=1 … queen=9). Kings are ignored. */
export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
}

const VALUE_ORDER = ['q', 'r', 'b', 'n', 'p']

/**
 * Sort captured piece types by material value (highest first).
 * Equal values use Q>R>B>N>P, then original capture order.
 */
export function sortCapturedByValue(pieces) {
  if (!pieces?.length) return []

  return pieces
    .map((type, index) => ({ type, index }))
    .sort((a, b) => {
      const valueDiff =
        (PIECE_VALUES[b.type] ?? 0) - (PIECE_VALUES[a.type] ?? 0)
      if (valueDiff !== 0) return valueDiff

      const orderDiff =
        VALUE_ORDER.indexOf(a.type) - VALUE_ORDER.indexOf(b.type)
      if (orderDiff !== 0) return orderDiff

      return a.index - b.index
    })
    .map((entry) => entry.type)
}

/** Sum material value of a list of captured piece types. */
export function materialValue(pieces) {
  return (pieces ?? []).reduce(
    (total, type) => total + (PIECE_VALUES[type] ?? 0),
    0,
  )
}

/**
 * Material advantage from White's perspective:
 * positive = White ahead, negative = Black ahead, 0 = even.
 * Uses pieces each side has *lost* (the existing captured map).
 */
export function getMaterialAdvantage(captured) {
  const whiteLost = materialValue(captured?.w)
  const blackLost = materialValue(captured?.b)
  const score = blackLost - whiteLost

  if (score > 0) {
    return { score, leader: 'w', label: `White +${score}` }
  }
  if (score < 0) {
    return { score, leader: 'b', label: `Black +${Math.abs(score)}` }
  }
  return { score: 0, leader: null, label: 'Even' }
}

/**
 * Column/row order for captured armies, matching clock orientation:
 * opponent (far side) first, bottom player second.
 */
export function getOrientedCapturedColors(orientation = 'w') {
  return orientation === 'w' ? ['b', 'w'] : ['w', 'b']
}
