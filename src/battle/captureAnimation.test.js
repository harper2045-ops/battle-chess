import { describe, expect, it } from 'vitest'
import {
  getCaptureActions,
  getCapturePose,
  squareToWorld,
} from './captureAnimation.js'

describe('3D capture presentation', () => {
  it('maps notation to stable board coordinates', () => {
    expect(squareToWorld('a1')).toEqual([-3.5, 0, 3.5])
    expect(squareToWorld('h8')).toEqual([3.5, 0, -3.5])
  })

  it('starts temporary actors on their explicit squares', () => {
    const pose = getCapturePose(
      { from: 'e5', to: 'd6', defenderSquare: 'd5' },
      0,
    )

    expect(pose.attacker).toEqual(squareToWorld('e5'))
    expect(pose.defender).toEqual(squareToWorld('d5'))
  })

  it('lunges the attacker and removes the defender', () => {
    const event = { from: 'e4', to: 'd5', defenderSquare: 'd5' }
    const start = getCapturePose(event, 0)
    const end = getCapturePose(event, 1)

    expect(end.attacker).not.toEqual(start.attacker)
    expect(end.defenderScale).toBeCloseTo(0.12)
    expect(end.defenderRotation).toBeCloseTo(1.35)
  })

  it('lunges toward the defender square on en passant, then settles onto to', () => {
    const event = { from: 'e5', to: 'd6', defenderSquare: 'd5' }
    const mid = getCapturePose(event, 0.5)
    const end = getCapturePose(event, 1)
    const from = squareToWorld('e5')
    const combat = squareToWorld('d5')
    const to = squareToWorld('d6')

    // Mid-strike: closer to the captured pawn than to the empty landing square.
    const midDistCombat = Math.hypot(mid.attacker[0] - combat[0], mid.attacker[2] - combat[2])
    const midDistTo = Math.hypot(mid.attacker[0] - to[0], mid.attacker[2] - to[2])
    expect(midDistCombat).toBeLessThan(midDistTo)

    // After settle: near the chess landing square, not stuck on the pawn file.
    expect(end.attacker[0]).toBeCloseTo(to[0], 1)
    expect(end.attacker[2]).toBeCloseTo(to[2], 1)
    expect(end.attacker[0]).not.toBeCloseTo(from[0], 1)
  })

  it('keeps normal captures lunging toward to when it equals defenderSquare', () => {
    const event = { from: 'e4', to: 'd5', defenderSquare: 'd5' }
    const mid = getCapturePose(event, 0.5)
    const to = squareToWorld('d5')
    const from = squareToWorld('e4')

    // Progress toward destination along both axes.
    expect(Math.abs(mid.attacker[0] - to[0])).toBeLessThan(
      Math.abs(from[0] - to[0]),
    )
    expect(Math.abs(mid.attacker[2] - to[2])).toBeLessThan(
      Math.abs(from[2] - to[2]),
    )
  })

  it('sequences humanoid attack, hit, and death clips', () => {
    expect(getCaptureActions(0)).toEqual({ attacker: 'idle', defender: 'idle' })
    expect(getCaptureActions(0.3)).toEqual({ attacker: 'attack', defender: 'hit' })
    expect(getCaptureActions(0.7)).toEqual({ attacker: 'attack', defender: 'death' })
  })

  it('keeps actors still for reduced motion', () => {
    expect(getCaptureActions(0.7, true)).toEqual({
      attacker: 'idle',
      defender: 'idle',
    })
  })
})
