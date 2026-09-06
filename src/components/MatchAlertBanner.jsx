/**
 * Cinematic check / mate / draw / timeout banner so elevated outcomes
 * read clearly without replacing the compact game-status line.
 */
export function MatchAlertBanner({ alert }) {
  if (!alert) return null

  return (
    <div
      aria-atomic="true"
      aria-live="assertive"
      className={`match-alert match-alert--${alert.kind}`}
      role="status"
    >
      <span aria-hidden="true" className="match-alert__glyph">
        {alert.glyph}
      </span>
      <div className="match-alert__copy">
        <strong className="match-alert__title">{alert.title}</strong>
        <span className="match-alert__detail">{alert.detail}</span>
      </div>
    </div>
  )
}
