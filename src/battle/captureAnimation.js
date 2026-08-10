const files = 'abcdefgh'

export const captureDuration = 760

export function squareToWorld(square) {
  return [files.indexOf(square[0]) - 3.5, 0, 4.5 - Number(square[1])]
}

export function getCapturePose(event, progress) {
  const t = Math.max(0, Math.min(1, progress))
  const from = squareToWorld(event.from)
  const to = squareToWorld(event.to)
  const defenderSquare = squareToWorld(event.defenderSquare)
  const lunge = (1 - Math.pow(1 - Math.min(t / 0.72, 1), 3)) * 0.82
  const defeat = Math.max(0, (t - 0.25) / 0.75)

  return {
    attacker: [
      from[0] + (to[0] - from[0]) * lunge,
      Math.sin(lunge * Math.PI) * 0.3,
      from[2] + (to[2] - from[2]) * lunge,
    ],
    defender: [
      defenderSquare[0] + defeat * 0.75,
      Math.sin(defeat * Math.PI) * 0.9 - defeat * 0.45,
      defenderSquare[2] + defeat * 0.9,
    ],
    defenderScale: 1 - defeat * 0.88,
    defenderRotation: defeat * 1.35,
  }
}
