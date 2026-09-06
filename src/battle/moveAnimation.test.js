import { describe, expect, it } from 'vitest'
import { squareToWorld } from './captureAnimation.js'
import {
  getQuietMoveAction,
  getQuietMovePose,
  getQuietMoveYaw,
  quietMoveDistance,
  quietMoveDuration,
  restingYaw,
} from './moveAnimation.js'

describe('3D quiet move presentation', () => {
  it('scales duration with board distance', () => {
    expect(quietMoveDistance('e2', 'e4')).toBe(2)
    expect(quietMoveDuration('e2', 'e4')).toBeGreaterThan(
      quietMoveDuration('e2', 'e3'),
    )
    expect(quietMoveDuration('e2', 'e4', true)).toBe(80)
  })

  it('treats knight jumps as hypot distance', () => {
    expect(quietMoveDistance('b1', 'c3')).toBeCloseTo(Math.hypot(1, 2))
  })

  it('plays walk then settles to idle', () => {
    expect(getQuietMoveAction(0)).toBe('walk')
    expect(getQuietMoveAction(0.5)).toBe('walk')
    expect(getQuietMoveAction(1)).toBe('idle')
    expect(getQuietMoveAction(0.5, true)).toBe('idle')
  })

  it('slides from origin to destination', () => {
    const event = { from: 'e2', to: 'e4' }
    expect(getQuietMovePose(event, 0)).toEqual(squareToWorld('e2'))
    expect(getQuietMovePose(event, 1)).toEqual(squareToWorld('e4'))
    const mid = getQuietMovePose(event, 0.5)
    expect(mid[0]).toBeCloseTo(squareToWorld('e2')[0])
    expect(mid[2]).toBeLessThan(squareToWorld('e2')[2])
    expect(mid[2]).toBeGreaterThan(squareToWorld('e4')[2])
  })

  it('hops knights off the board surface mid-jump', () => {
    const event = { from: 'b1', to: 'c3' }
    expect(getQuietMovePose(event, 0)[1]).toBeCloseTo(0)
    expect(getQuietMovePose(event, 0.5)[1]).toBeGreaterThan(0.2)
    expect(getQuietMovePose(event, 1)[1]).toBeCloseTo(0)
  })

  it('yaws toward the destination while walking then settles', () => {
    const event = { from: 'a2', to: 'a4' }
    // a-file north: dx=0, dz negative → travel yaw 0 for white
    expect(getQuietMoveYaw(event, 0.5, 'w')).toBeCloseTo(0)
    expect(getQuietMoveYaw(event, 1, 'w')).toBeCloseTo(restingYaw('w'))

    const lateral = { from: 'e2', to: 'h2' }
    // east along rank: +X → yaw toward +X from -Z forward ≈ +PI/2
    expect(getQuietMoveYaw(lateral, 0.4, 'w')).toBeCloseTo(Math.PI / 2)
    expect(getQuietMoveYaw(lateral, 1, 'b')).toBeCloseTo(restingYaw('b'))
  })
})
