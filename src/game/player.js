export function isBotTurn(mode, playerColor, turn) {
  return mode === 'bot' && turn !== playerColor
}
