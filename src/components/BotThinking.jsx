import { formatBotThinkingLabel } from '../game/botThinking.js'

/**
 * Dedicated Stockfish “thinking” indicator so the main game-status line
 * can keep showing turn / check / mate while the bot searches.
 */
export function BotThinking({ active, difficulty }) {
  if (!active) return null

  const label = formatBotThinkingLabel(difficulty)

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="bot-thinking"
      role="status"
    >
      <span aria-hidden="true" className="bot-thinking__glyph">
        🤖
      </span>
      <span className="bot-thinking__label">{label}</span>
      <span aria-hidden="true" className="bot-thinking__dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  )
}
