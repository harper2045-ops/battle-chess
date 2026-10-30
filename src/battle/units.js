import loadout from './loadout.json'

/**
 * Unit manifest: which model, clips and props each side's piece uses.
 *
 * The two armies were generated locally (see docs/design/2026-10-29-battle-chess-1988-
 * redesign.md): white is ivory plate and royal blue, black is dark steel and crimson.
 * Each unit is one GLB holding the mesh, skeleton and every clip; weapons and shields
 * are separate GLBs attached to a hand bone at load (loadout.json, written by
 * scripts/assets/attach_props.py), so battle scenes can drop or swap them.
 */

export const DRACO_PATH = '/draco/'

const MODEL_ROOT = '/models/armies'

/**
 * Half-turn applied to every unit model. The board's yaw (white 0, black π, and move
 * yaw) was set for the Ivory Kingdom models; the generated ones face the other way, so
 * without this both armies turned their backs on each other (seen 2026-10-30).
 */
export const MODEL_TURN = Math.PI

/** Clip names inside every unit GLB (scripts/assets/pack_units.py). */
export const CLIPS = ['idle', 'attack', 'hit', 'death', 'walk']

export function unitKey(piece) {
  return `${piece.color}_${piece.type}`
}

export function propUrl(prop) {
  return `${MODEL_ROOT}/props/${prop}.glb`
}

/** All prop files, so one loader call covers every piece (promotion swaps types). */
export const PROP_URLS = [...new Set(Object.values(loadout).flat().map((p) => propUrl(p.prop)))]

export const UNITS = Object.fromEntries(
  ['w', 'b'].flatMap((color) =>
    ['p', 'n', 'b', 'r', 'q', 'k'].map((type) => {
      const key = `${color}_${type}`
      return [
        key,
        {
          model: `${MODEL_ROOT}/${key}.glb`,
          // The rook golem fights with its fists, so it has no entry in loadout.json.
          props: (loadout[key] ?? []).map(({ prop, bone, hand, matrix }) => ({
            prop,
            url: propUrl(prop),
            bone,
            hand,
            matrix: [...matrix],
          })),
        },
      ]
    }),
  ),
)

export function unitFor(piece) {
  return UNITS[unitKey(piece)]
}
