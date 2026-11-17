const SIGNATURES = [
  {
    id: 'queen-spell',
    matches: (event) => (event.promotion ?? event.attacker.type) === 'q',
    sound: 'spell-cast',
    shot: 'close-attacker',
  },
  {
    id: 'rook-golem-smash',
    matches: (event) => event.attacker.type === 'r',
    sound: 'stone-smash',
    shot: 'low-hero',
  },
  {
    id: 'knight-charge',
    matches: (event) => event.attacker.type === 'n',
    sound: 'cavalry-charge',
    shot: 'wide-two-shot',
  },
  {
    id: 'pawn-spear-duel',
    matches: (event) => event.attacker.type === 'p' && event.defender.type === 'p',
    sound: 'spear-thrust',
    shot: 'close-attacker',
  },
]

/**
 * Gap between the two fighters' centres when the attacker strikes, in arena units
 * (1 = one board square). Close enough that the weapon (or the golem's fist) lands on
 * the defender; longer weapons stand a little further off.
 */
export const STRIKE_DISTANCE = Object.freeze({
  p: 0.6, // spear
  n: 0.6, // longsword
  b: 0.5, // mace
  r: 0.5, // fists
  q: 0.6, // staff
  k: 0.65, // greatsword
})

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function seedFraction(seed) {
  const text = String(seed)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function clipDuration(table, piece, clip) {
  const value = table?.[`${piece.color}_${piece.type}`]?.[clip]
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Missing positive ${clip} duration for ${piece.color}_${piece.type}`)
  }
  return value
}

/** How much faster a fight clip plays in Short battles. */
export const SHORT_FIGHT_SPEED = 1.8

/**
 * The attacker's fight clip and the moment its blow lands (fightHit, seconds into the
 * clip; scripts/assets/make_fight_clips.py writes it to fightTiming.json), or null when
 * the unit has no fight clip and the battle uses walk + attack instead.
 */
function fightClip(table, piece) {
  const entry = table?.[`${piece.color}_${piece.type}`]
  const { fight, fightHit } = entry ?? {}
  if (!Number.isFinite(fight) || !Number.isFinite(fightHit) || fightHit <= 0 || fightHit >= fight) {
    return null
  }
  return { duration: fight, hitTime: fightHit }
}

function rounded(value) {
  return Number(value.toFixed(3))
}

/**
 * Convert a capture and measured GLB clip lengths into deterministic choreography.
 * clipDurations is keyed like units.js: w_p: { walk, attack, hit, death }, plus
 * { fight, fightHit } when the unit has a fight clip. With one, the attacker plays it
 * whole (it walks in, strikes and recovers on its own) and the defender reacts when its
 * blow lands; script.fight then tells the theater where that blow is in the clip.
 */
export function planBattle(event, { mode = 'full', seed = 0, clipDurations } = {}) {
  if (mode !== 'full' && mode !== 'short') {
    throw new Error(`Unknown battle mode: ${mode}`)
  }

  const attacker = {
    type: event.promotion ?? event.attacker.type,
    color: event.attacker.color,
    mark: 'A',
  }
  const defender = { ...event.defender, mark: 'B' }
  const fight = fightClip(clipDurations, attacker)
  const hit = clipDuration(clipDurations, defender, 'hit')
  const death = clipDuration(clipDurations, defender, 'death')
  const full = mode === 'full'
  const scale = full ? 1 : 0.55
  const reaction = clamp(hit * 0.5 * scale, full ? 0.2 : 0.1, full ? 0.65 : 0.35)
  const fall = clamp(death * 0.65 * scale, full ? 0.55 : 0.3, full ? 1.5 : 0.8)
  const jitter = (seedFraction(seed) - 0.5) * (full ? 0.24 : 0.12)
  const tail = full ? 1 : 0.45
  let attackAt, hitAt, strike, duration
  if (fight) {
    // The clip sets the pace: the hit lands on its blow, the close-up comes in just
    // before it, and the fade waits for the defender to fall.
    const speed = full ? 1 : SHORT_FIGHT_SPEED
    hitAt = rounded(fight.hitTime / speed)
    attackAt = rounded(Math.max(0, hitAt - (full ? 0.8 : 0.45)))
    strike = hitAt - attackAt
    duration = rounded(clamp(hitAt + reaction + fall + tail + jitter, full ? 3 : 1.5, full ? 8 : 4))
  } else {
    const walk = clipDuration(clipDurations, attacker, 'walk')
    const attack = clipDuration(clipDurations, attacker, 'attack')
    const approach = clamp(walk * 0.45 * scale, full ? 0.45 : 0.25, full ? 1.2 : 0.6)
    strike = clamp(attack * 0.5 * scale, full ? 0.3 : 0.15, full ? 1.2 : 0.65)
    duration = rounded(clamp(
      approach + strike + reaction + fall + tail + jitter,
      full ? 3 : 1.5,
      full ? 6 : 2.5,
    ))
    attackAt = rounded(approach)
    hitAt = rounded(attackAt + strike)
  }
  const deathAt = rounded(hitAt + reaction)
  const signature = SIGNATURES.find(({ matches }) => matches(event))
  const matchup = signature?.id ?? 'generic'
  const shot = signature?.shot ?? 'close-attacker'
  const sound = signature?.sound ?? 'sword-hit'

  const attackerBeats = fight
    ? [{ t: 0, actor: 'attacker', clip: 'fight' }]
    : [
        { t: 0, actor: 'attacker', clip: 'walk', to: 'engage' },
        { t: attackAt, actor: 'attacker', clip: 'attack' },
      ]
  const beats = [
    { t: 0, shot: 'wide-two-shot' },
    ...attackerBeats,
    { t: attackAt, shot: shot },
    { t: hitAt, sound },
    { t: hitAt, actor: 'defender', clip: 'hit' },
    { t: deathAt, shot: 'close-defender' },
    { t: deathAt, actor: 'defender', clip: 'death' },
  ]

  if (matchup === 'pawn-spear-duel') {
    beats.push({ t: rounded(attackAt + strike * 0.45), sound: 'spear-clash' })
  }

  beats.push({ t: rounded(duration - (full ? 0.45 : 0.25)), shot: 'fade-out' })
  beats.sort((a, b) => a.t - b.t)

  return {
    duration,
    arena: 'courtyard',
    matchup,
    strikeDistance: STRIKE_DISTANCE[attacker.type],
    fight: fight && { hitTime: fight.hitTime, speed: full ? 1 : SHORT_FIGHT_SPEED },
    actors: { attacker, defender },
    capture: {
      from: event.from,
      to: event.to,
      defenderSquare: event.defenderSquare,
      promotion: event.promotion ?? null,
    },
    beats,
  }
}
