import { Matrix4 } from 'three'

/**
 * Where a prop sits on its hand bone.
 *
 * `placement` puts the loaded prop scene in the unit's model space at the bind pose
 * (loadout.json). The bone's bind pose in model space is bindMatrix × inverse(boneInverse),
 * so the prop's offset under the bone is the inverse of that times the placement.
 */
export function propOffset(bindMatrix, boneInverse, placement) {
  return boneInverse.clone().multiply(bindMatrix.clone().invert()).multiply(placement)
}

/** First skinned mesh under `actor` (each unit GLB has one). */
function findSkinnedMesh(actor) {
  let found = null
  actor.traverse((node) => {
    if (!found && node.isSkinnedMesh) found = node
  })
  return found
}

/**
 * Clone each prop scene and parent it to its hand bone. `props` are unit manifest
 * entries ({ url, bone, matrix }); `scenes` maps url → loaded GLTF scene. Returns the
 * attached prop roots (named after the prop) so callers can hide or swap them.
 */
export function attachProps(actor, props, scenes) {
  const mesh = findSkinnedMesh(actor)
  if (!mesh) return []
  const { bones, boneInverses } = mesh.skeleton
  const attached = []
  for (const entry of props) {
    const index = bones.findIndex((b) => b.name === entry.bone)
    const scene = scenes[entry.url]
    if (index < 0 || !scene) continue
    const prop = scene.clone(true)
    prop.name = entry.prop
    const offset = propOffset(mesh.bindMatrix, boneInverses[index], new Matrix4().fromArray(entry.matrix))
    offset.decompose(prop.position, prop.quaternion, prop.scale)
    bones[index].add(prop)
    attached.push(prop)
  }
  return attached
}
