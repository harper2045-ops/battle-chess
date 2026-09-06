const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

/** Human-readable Stockfish difficulty for UI copy. */
export function formatDifficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[difficulty] ?? 'Medium'
}

/**
 * Live status string shown while Stockfish is choosing a move.
 * Keeps the chess status line free for turn / check / mate.
 */
export function formatBotThinkingLabel(difficulty) {
  return `Bot thinking (${formatDifficultyLabel(difficulty)})…`
}
