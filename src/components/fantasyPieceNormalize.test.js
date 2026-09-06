import { describe, expect, it } from 'vitest'
import { Box3, BoxGeometry, Group, Mesh } from 'three'
import { TARGET_HEIGHT, normalizeIvoryActor } from './ivoryNormalize.js'

describe('Ivory piece height normalize', () => {
  it('exposes two-tier King\'s Gambit target heights', () => {
    expect(TARGET_HEIGHT.p).toBe(0.78)
    expect(TARGET_HEIGHT.n).toBe(0.98)
    expect(TARGET_HEIGHT.b).toBe(1.0)
    expect(TARGET_HEIGHT.r).toBe(0.99)
    expect(TARGET_HEIGHT.q).toBe(1.0)
    expect(TARGET_HEIGHT.k).toBe(1.12)
    expect(TARGET_HEIGHT.p).toBeLessThan(TARGET_HEIGHT.n)
    expect(TARGET_HEIGHT.k).toBeGreaterThan(TARGET_HEIGHT.q)
  })

  it('scales a tall sculpt down and grounds the soles on y=0', () => {
    const actor = new Group()
    // Fake humanoid: 1.7 tall, feet at y=0, slightly off-centre.
    const mesh = new Mesh(new BoxGeometry(0.5, 1.7, 0.4))
    mesh.position.set(0.1, 0.85, -0.05)
    actor.add(mesh)

    const { scale, height } = normalizeIvoryActor(actor, 'p')

    expect(height).toBe(0.78)
    expect(scale).toBeCloseTo(0.78 / 1.7, 5)

    actor.updateMatrixWorld(true)
    const box = new Box3().setFromObject(actor)
    expect(box.min.y).toBeCloseTo(0, 4)
    expect(box.max.y - box.min.y).toBeCloseTo(0.78, 3)
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 3)
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 3)
  })
})
