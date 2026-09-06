/**
 * Presentation fields that must be wiped whenever chess.js position is
 * replaced (reset, undo/redo, mode/color/time-control) or the match ends
 * on the clock. Leaving activeMove/activeCapture (or a battle banner)
 * behind desyncs 3D actors from the board.
 */
export function clearedPresentationState() {
  return {
    selected: null,
    legalMoves: [],
    battleEvent: null,
    activeCapture: null,
    activeMove: null,
    copyStatus: '',
    thinking: false,
  }
}
