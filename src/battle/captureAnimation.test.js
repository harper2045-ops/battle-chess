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
