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

function rounded(value) {
  return Number(value.toFixed(3))
}

/**
 * Convert a capture and measured GLB clip lengths into deterministic choreography.
 * clipDurations is keyed like units.js: w_p: { walk, attack, hit, death }.
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
  const walk = clipDuration(clipDurations, attacker, 'walk')
  const attack = clipDuration(clipDurations, attacker, 'attack')
  const hit = clipDuration(clipDurations, defender, 'hit')
  const death = clipDuration(clipDurations, defender, 'death')
  const full = mode === 'full'
  const scale = full ? 1 : 0.55
  const approach = clamp(walk * 0.45 * scale, full ? 0.45 : 0.25, full ? 1.2 : 0.6)
  const strike = clamp(attack * 0.5 * scale, full ? 0.3 : 0.15, full ? 1.2 : 0.65)
  const reaction = clamp(hit * 0.5 * scale, full ? 0.2 : 0.1, full ? 0.65 : 0.35)
  const fall = clamp(death * 0.65 * scale, full ? 0.55 : 0.3, full ? 1.5 : 0.8)
  const jitter = (seedFraction(seed) - 0.5) * (full ? 0.24 : 0.12)
  const duration = rounded(clamp(
    approach + strike + reaction + fall + (full ? 1 : 0.45) + jitter,
    full ? 3 : 1.5,
    full ? 6 : 2.5,
  ))
  const attackAt = rounded(approach)
  const hitAt = rounded(attackAt + strike)
  const deathAt = rounded(hitAt + reaction)
  const signature = SIGNATURES.find(({ matches }) => matches(event))
  const matchup = signature?.id ?? 'generic'
  const shot = signature?.shot ?? 'close-attacker'
  const sound = signature?.sound ?? 'sword-hit'

  const beats = [
    { t: 0, shot: 'wide-two-shot' },
    { t: 0, actor: 'attacker', clip: 'walk', to: 'engage' },
    { t: attackAt, shot: shot },
    { t: attackAt, actor: 'attacker', clip: 'attack' },
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
