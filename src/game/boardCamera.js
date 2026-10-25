export function getBoardCameraPosition(orientation, aspect) {
  const fit = Math.max(1, 1.3 / aspect)
  return [0, 8.4 * fit, (orientation === 'w' ? 8.8 : -8.8) * fit]
}

export function getBoardCameraMaxDistance(orientation, aspect) {
  return Math.max(13, Math.hypot(...getBoardCameraPosition(orientation, aspect)))
}
