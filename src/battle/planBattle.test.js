import { describe, expect, it } from 'vitest'
import { planBattle } from './planBattle.js'
import fightTiming from './fightTiming.json'

const TYPES = ['p', 'n', 'b', 'r', 'q', 'k']
const CLIP_DURATIONS = Object.fromEntries(
  ['w', 'b'].flatMap((color) =>
    TYPES.map((type) => [
      `${color}_${type}`,
      { walk: 1.2, attack: 1.0, hit: 0.6, death: 1.8 },
    ]),
  ),
)

function capture(attackerType = 'n', defenderType = 'p', color = 'w', extra = {}) {
  return {
    id: 1,
    type: 'capture',
    attacker: { type: attackerType, color },
    defender: { type: defenderType, color: color === 'w' ? 'b' : 'w' },
    from: color === 'w' ? 'g1' : 'g8',
    to: color === 'w' ? 'f3' : 'f6',
    defenderSquare: color === 'w' ? 'f3' : 'f6',
    promotion: null,
    ...extra,
  }
}

function plan(event, mode = 'full', seed = 7) {
  return planBattle(event, { mode, seed, clipDurations: CLIP_DURATIONS })
}

describe('planBattle', () => {
  it.each(['full', 'short'])('plans every type pair in both colors for %s mode', (mode) => {
    for (const color of ['w', 'b']) {
      for (const attacker of TYPES) {
        for (const defender of TYPES) {
          const script = plan(capture(attacker, defender, color), mode)
          const [minimum, maximum] = mode === 'full' ? [3, 6] : [1.5, 2.5]
          expect(script.duration).toBeGreaterThanOrEqual(minimum)
          expect(script.duration).toBeLessThanOrEqual(maximum)
          expect(script.actors.attacker).toEqual({ type: attacker, color, mark: 'A' })
          expect(script.actors.defender.type).toBe(defender)
          expect(script.beats.length).toBeGreaterThan(4)

          script.beats.forEach((beat, index) => {
            expect(beat.t).toBeGreaterThanOrEqual(0)
            expect(beat.t).toBeLessThanOrEqual(script.duration)
            if (index > 0) expect(beat.t).toBeGreaterThanOrEqual(script.beats[index - 1].t)
          })

          const actorBeats = script.beats.filter((beat) => beat.actor === 'defender' && beat.clip)
          expect(actorBeats.at(-1).clip).toBe('death')
        }
      }
    }
  })

  it('provides four signature matchups', () => {
    expect(plan(capture('q', 'p')).matchup).toBe('queen-spell')
    expect(plan(capture('r', 'p')).matchup).toBe('rook-golem-smash')
    expect(plan(capture('n', 'p')).matchup).toBe('knight-charge')
    expect(plan(capture('p', 'p')).matchup).toBe('pawn-spear-duel')
  })

  it('supports en passant and promotion captures', () => {
    const enPassant = plan(capture('p', 'p', 'w', {
      from: 'e5', to: 'd6', defenderSquare: 'd5',
    }))
    expect(enPassant.capture.defenderSquare).toBe('d5')

    const promotion = plan(capture('p', 'r', 'w', { promotion: 'q' }))
    expect(promotion.actors.attacker.type).toBe('q')
    expect(promotion.matchup).toBe('queen-spell')
  })

  it('closes to striking distance for every attacker, using the promoted type', () => {
    for (const attacker of TYPES) {
      const distance = plan(capture(attacker, 'p')).strikeDistance
      expect(distance).toBeGreaterThan(0.3)
      expect(distance).toBeLessThan(0.8)
    }
    expect(plan(capture('p', 'r', 'w', { promotion: 'q' })).strikeDistance)
      .toBe(plan(capture('q', 'r')).strikeDistance)
  })

  it('is deterministic for the same seed', () => {
    expect(plan(capture('q', 'k'), 'full', 42)).toEqual(plan(capture('q', 'k'), 'full', 42))
  })

  describe('with a fight clip (walk-in, own attack and recovery in one clip)', () => {
    const WITH_FIGHT = structuredClone(CLIP_DURATIONS)
    for (const [key, timing] of Object.entries(fightTiming)) {
      WITH_FIGHT[key].fight = timing.duration
      WITH_FIGHT[key].fightHit = timing.hit
    }
    const fightPlan = (event, mode = 'full', seed = 7) =>
      planBattle(event, { mode, seed, clipDurations: WITH_FIGHT })

    it.each(['full', 'short'])('plays the fight clip and lands the hit on its blow in %s mode', (mode) => {
      for (const color of ['w', 'b']) {
        for (const attacker of TYPES) {
          for (const defender of TYPES) {
            const script = fightPlan(capture(attacker, defender, color), mode)
            const attackerBeats = script.beats.filter((beat) => beat.actor === 'attacker')
            expect(attackerBeats.map((beat) => beat.clip)).toEqual(['fight'])
            const hit = script.beats.find((beat) => beat.actor === 'defender' && beat.clip === 'hit')
            const blow = fightTiming[`${color}_${attacker}`].hit
            expect(hit.t).toBeCloseTo(blow / script.fight.speed, 2)
            expect(script.fight.hitTime).toBe(blow)
            const defenderBeats = script.beats.filter((beat) => beat.actor === 'defender')
            expect(defenderBeats.at(-1).clip).toBe('death')
            script.beats.forEach((beat, index) => {
              expect(beat.t).toBeGreaterThanOrEqual(0)
              expect(beat.t).toBeLessThanOrEqual(script.duration)
              if (index > 0) expect(beat.t).toBeGreaterThanOrEqual(script.beats[index - 1].t)
            })
            expect(script.duration).toBeLessThanOrEqual(mode === 'full' ? 8 : 4)
          }
        }
      }
    })

    it('plays faster and ends sooner in short mode', () => {
      const event = capture('q', 'p')
      const full = fightPlan(event, 'full')
      const short = fightPlan(event, 'short')
      expect(full.fight.speed).toBe(1)
      expect(short.fight.speed).toBeGreaterThan(1)
      expect(short.duration).toBeLessThan(full.duration)
    })

    it('falls back to walk and attack when the attacker has no fight clip', () => {
      const partial = structuredClone(WITH_FIGHT)
      delete partial.w_n.fight
      const script = planBattle(capture('n', 'p'), { mode: 'full', seed: 7, clipDurations: partial })
      expect(script.fight).toBeNull()
      expect(script.beats.filter((beat) => beat.actor === 'attacker').map((beat) => beat.clip))
        .toEqual(['walk', 'attack'])
    })

    it('has a blow inside every packed fight clip', () => {
      expect(Object.keys(fightTiming)).toHaveLength(12)
      for (const timing of Object.values(fightTiming)) {
        expect(timing.hit).toBeGreaterThan(0)
        expect(timing.hit).toBeLessThan(timing.duration)
      }
    })
  })

  it('uses supplied clip durations rather than hard-coded animation lengths', () => {
    const longer = structuredClone(CLIP_DURATIONS)
    longer.w_n.attack = 2.4
    const event = capture('n', 'p')
    expect(planBattle(event, {
      mode: 'full', seed: 7, clipDurations: longer,
    }).duration).not.toBe(plan(event).duration)
  })
})
