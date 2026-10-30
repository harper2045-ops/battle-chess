import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bone, Matrix4, Quaternion, Vector3 } from 'three'
import { PROP_URLS, UNITS, unitFor } from './units.js'
import { propOffset } from './propAttach.js'

const publicPath = (url) => new URL(`../../public${url}`, import.meta.url)

describe('unit manifest', () => {
  it('has a unit file for all 12 pieces', () => {
    for (const color of ['w', 'b']) {
      for (const type of ['p', 'n', 'b', 'r', 'q', 'k']) {
        const unit = unitFor({ color, type })
        expect(unit, `${color}_${type}`).toBeDefined()
        expect(existsSync(publicPath(unit.model)), unit.model).toBe(true)
      }
    }
  })

  it('arms everyone but the rook golems, with props that exist', () => {
    for (const [key, unit] of Object.entries(UNITS)) {
      expect(unit.props.length, key).toBe(key.endsWith('_r') ? 0 : key.endsWith('_p') || key.endsWith('_n') ? 2 : 1)
      for (const prop of unit.props) {
        expect(prop.prop.startsWith(key[0]), `${key} holds its own army's ${prop.prop}`).toBe(true)
        expect(prop.bone).toMatch(/^bone_\d+$/)
        expect(prop.matrix).toHaveLength(16)
        expect(PROP_URLS).toContain(prop.url)
      }
    }
    for (const url of PROP_URLS) expect(existsSync(publicPath(url)), url).toBe(true)
  })
})

describe('propOffset', () => {
  it('puts the prop back at its placement when the bone is at its bind pose', () => {
    const bindMatrix = new Matrix4().makeTranslation(0, 0.5, 0)
    const boneBind = new Matrix4().compose(
      new Vector3(0.3, 0.9, 0.1),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.7),
      new Vector3(1, 1, 1),
    )
    // three/glTF: bone bind pose in model space = bindMatrix × inverse(boneInverse)
    const boneInverse = boneBind.clone().invert().multiply(bindMatrix)
    const placement = new Matrix4().compose(
      new Vector3(-0.2, 0.8, 0.05),
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.3),
      new Vector3(0.4, 0.4, 0.4),
    )

    const offset = propOffset(bindMatrix, boneInverse, placement)
    const bone = new Bone()
    boneBind.decompose(bone.position, bone.quaternion, bone.scale)
    const child = new Bone()
    offset.decompose(child.position, child.quaternion, child.scale)
    bone.add(child)
    bone.updateMatrixWorld(true)

    const got = child.matrixWorld.elements
    placement.elements.forEach((value, i) => expect(got[i]).toBeCloseTo(value, 5))
  })
})
