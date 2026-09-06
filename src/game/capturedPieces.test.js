import { describe, expect, it } from 'vitest'
import {
  getMaterialAdvantage,
  getOrientedCapturedColors,
  materialValue,
  sortCapturedByValue,
} from './capturedPieces.js'

describe('captured piece display helpers', () => {
  it('sorts captured pieces by material value, queens first', () => {
    expect(sortCapturedByValue(['p', 'q', 'n', 'r', 'p', 'b'])).toEqual([
      'q',
      'r',
      'b',
      'n',
      'p',
      'p',
    ])
  })

  it('breaks equal material with bishop before knight, then capture order', () => {
    expect(sortCapturedByValue(['n', 'b', 'n'])).toEqual(['b', 'n', 'n'])
  })

  it('handles empty and missing lists', () => {
    expect(sortCapturedByValue([])).toEqual([])
    expect(sortCapturedByValue(undefined)).toEqual([])
    expect(materialValue(undefined)).toBe(0)
  })

  it('sums material values', () => {
    expect(materialValue(['q', 'p', 'p'])).toBe(11)
    expect(materialValue(['r', 'n'])).toBe(8)
  })

  it('reports White material advantage from Black losses minus White losses', () => {
    expect(
      getMaterialAdvantage({
        w: ['p'],
        b: ['q', 'p'],
      }),
    ).toEqual({ score: 9, leader: 'w', label: 'White +9' })
  })

  it('reports Black advantage when White has lost more', () => {
    expect(
      getMaterialAdvantage({
        w: ['r', 'n'],
        b: ['p'],
      }),
    ).toEqual({ score: -7, leader: 'b', label: 'Black +7' })
  })

  it('reports Even when material is balanced', () => {
    expect(getMaterialAdvantage({ w: ['n'], b: ['b'] })).toEqual({
      score: 0,
      leader: null,
      label: 'Even',
    })
    expect(getMaterialAdvantage({ w: [], b: [] })).toEqual({
      score: 0,
      leader: null,
      label: 'Even',
    })
  })

  it('orders captured armies like the clocks for board orientation', () => {
    expect(getOrientedCapturedColors('w')).toEqual(['b', 'w'])
    expect(getOrientedCapturedColors('b')).toEqual(['w', 'b'])
    expect(getOrientedCapturedColors()).toEqual(['b', 'w'])
  })
})
