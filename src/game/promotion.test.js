import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import {
  PROMOTION_CHOICES,
  getPromotionOptions,
  promotionChoicesFor,
} from './promotion.js'

describe('promotion helpers', () => {
  it('lists Ivory-named choices for the four underpromotion pieces', () => {
    expect(PROMOTION_CHOICES.map((choice) => choice.type)).toEqual([
      'q',
      'r',
      'b',
      'n',
    ])
    expect(PROMOTION_CHOICES.find((choice) => choice.type === 'r').ivoryName).toBe(
      'Guardian',
    )
    expect(PROMOTION_CHOICES.find((choice) => choice.type === 'b').ivoryName).toBe(
      'Mage',
    )
  })

  it('returns promotion options when a pawn reaches the last rank', () => {
    const chess = new Chess('8/P7/8/8/8/8/8/4K2k w - - 0 1')
    expect(getPromotionOptions(chess, 'a7', 'a8')).toEqual(['q', 'r', 'b', 'n'])
  })

  it('returns null for non-promotion destinations', () => {
    const chess = new Chess()
    expect(getPromotionOptions(chess, 'e2', 'e4')).toBeNull()
    expect(getPromotionOptions(chess, 'b1', 'c3')).toBeNull()
  })

  it('returns null when the move is illegal', () => {
    const chess = new Chess('8/P7/8/8/8/8/8/4K2k w - - 0 1')
    expect(getPromotionOptions(chess, 'a7', 'b8')).toBeNull()
  })

  it('filters display choices to the legal promotion set', () => {
    expect(promotionChoicesFor(['q', 'n']).map((choice) => choice.type)).toEqual([
      'q',
      'n',
    ])
  })
})
