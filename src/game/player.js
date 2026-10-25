export function isBotTurn(mode, playerColor, turn) {
  return mode === 'bot' && turn !== playerColor
}

export function canScheduleBot(screen, mode, playerColor, turn) {
  return screen === 'game' && isBotTurn(mode, playerColor, turn)
}
