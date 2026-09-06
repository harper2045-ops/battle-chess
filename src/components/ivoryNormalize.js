import { Box3, Vector3 } from 'three'

/**
 * Target on-board heights (1 unit = 1 square), matching King's Gambit
 * `PIECE_HEIGHT` in ainan9274/rork-medieval-3d-chess — two readable tiers:
 * footsoldiers vs everyone else, with the king alone a step above.
 */
export const TARGET_HEIGHT = {
  p: 0.78,
  n: 0.98,
  b: 1.0,
  r: 0.99,
  q: 1.0,
  k: 1.12,
}

/**
 * One-time scale + ground/center like King's Gambit `PieceFactory.normalize()`:
 * measure the sculpt, scale to TARGET_HEIGHT, put soles on y=0 and centre XZ.
 */
export function normalizeIvoryActor(actor, type) {
  actor.updateMatrixWorld(true)
  const box = new Box3().setFromObject(actor)
  const size = new Vector3()
  const center = new Vector3()
  box.getSize(size)
  box.getCenter(center)

  const height = Math.max(1e-4, size.y)
  const scale = TARGET_HEIGHT[type] / height
  actor.scale.setScalar(scale)
  actor.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)

  return { scale, height: TARGET_HEIGHT[type] }
}
