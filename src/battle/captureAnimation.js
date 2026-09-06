const files = 'abcdefgh'

export const captureDuration = 760

export function getCaptureActions(progress, reducedMotion = false) {
  if (reducedMotion) {
    return { attacker: 'idle', defender: 'idle' }
  }

  const t = Math.max(0, Math.min(1, progress))

  return {
    attacker: t < 0.08 ? 'idle' : 'attack',
    defender: t < 0.28 ? 'idle' : t < 0.52 ? 'hit' : 'death',
  }
}

export function squareToWorld(square) {
  return [files.indexOf(square[0]) - 3.5, 0, 4.5 - Number(square[1])]
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/**
 * Attacker lunges toward the defender's square (combat), then settles onto
 * `to` when that differs — en passant lands one rank past the captured pawn.
 */
export function getCapturePose(event, progress) {
  const t = Math.max(0, Math.min(1, progress))
  const from = squareToWorld(event.from)
  const to = squareToWorld(event.to)
  const combat = squareToWorld(event.defenderSquare)
  const lunge = (1 - Math.pow(1 - Math.min(t / 0.72, 1), 3)) * 0.82
  const defeat = Math.max(0, (t - 0.25) / 0.75)

  let attackerX = from[0] + (combat[0] - from[0]) * lunge
  let attackerZ = from[2] + (combat[2] - from[2]) * lunge

  // En passant (and any capture where landing ≠ defender): finish onto `to`.
  if (event.defenderSquare !== event.to && t > 0.72) {
    const settle = smoothstep((t - 0.72) / 0.28)
    const afterStrikeX = from[0] + (combat[0] - from[0]) * 0.82
    const afterStrikeZ = from[2] + (combat[2] - from[2]) * 0.82
    attackerX = afterStrikeX + (to[0] - afterStrikeX) * settle
    attackerZ = afterStrikeZ + (to[2] - afterStrikeZ) * settle
  }

  return {
    attacker: [
      attackerX,
      Math.sin(lunge * Math.PI) * 0.3,
      attackerZ,
    ],
    defender: [
      combat[0] + defeat * 0.75,
      Math.sin(defeat * Math.PI) * 0.9 - defeat * 0.45,
      combat[2] + defeat * 0.9,
    ],
    defenderScale: 1 - defeat * 0.88,
    defenderRotation: defeat * 1.35,
  }
}
