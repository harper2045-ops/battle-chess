/** Ivory Kingdom display names for underpromotion choices. */
export const PROMOTION_CHOICES = [
  { type: 'q', chessName: 'Queen', ivoryName: 'Queen', symbol: { w: '♕', b: '♛' } },
  { type: 'r', chessName: 'Rook', ivoryName: 'Guardian', symbol: { w: '♖', b: '♜' } },
  { type: 'b', chessName: 'Bishop', ivoryName: 'Mage', symbol: { w: '♗', b: '♝' } },
  { type: 'n', chessName: 'Knight', ivoryName: 'Knight', symbol: { w: '♘', b: '♞' } },
]

/**
 * If moving from→to requires a promotion choice, return the legal promotion
 * piece types (usually q/r/b/n). Otherwise null.
 */
export function getPromotionOptions(chess, from, to) {
  if (!from || !to) return null

  const candidates = chess
    .moves({ square: from, verbose: true })
    .filter((move) => move.to === to)

  if (!candidates.length) return null

  const found = new Set(
    candidates.map((move) => move.promotion).filter(Boolean),
  )

  // Stable UI order: Queen → Rook → Bishop → Knight (matches PROMOTION_CHOICES).
  const promotions = PROMOTION_CHOICES.map((choice) => choice.type).filter(
    (type) => found.has(type),
  )

  return promotions.length ? promotions : null
}

export function promotionChoicesFor(types) {
  const allowed = new Set(types)
  return PROMOTION_CHOICES.filter((choice) => allowed.has(choice.type))
}
