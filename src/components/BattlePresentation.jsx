import {
  getMaterialAdvantage,
  getOrientedCapturedColors,
  sortCapturedByValue,
} from '../game/capturedPieces.js'

const pieceSymbols = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
}

const pieceNames = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
}

const colorNames = {
  w: 'White',
  b: 'Black',
}

export function BattleBanner({ event }) {
  return (
    <div className="battle-banner" aria-live="polite" aria-atomic="true">
      {event ? (
        <div className="battle-banner__event" key={event.id}>
          <span className="battle-banner__label">Battle report</span>
          <strong>
            {colorNames[event.attacker.color]} {pieceNames[event.attacker.type]}
            {' captured '}
            {colorNames[event.defender.color]} {pieceNames[event.defender.type]}
          </strong>
          <span className="battle-banner__route">
            {event.from.toUpperCase()} → {event.to.toUpperCase()}
          </span>
        </div>
      ) : (
        <span className="battle-banner__idle">The armies await first contact.</span>
      )}
    </div>
  )
}

function CapturedArmy({ color, pieces }) {
  const sorted = sortCapturedByValue(pieces)

  return (
    <div className="captured-army">
      <span className="captured-army__label">
        {colorNames[color]} losses
      </span>
      <span
        className="captured-army__pieces"
        aria-label={
          sorted.length
            ? sorted.map((piece) => pieceNames[piece]).join(', ')
            : 'None'
        }
      >
        {sorted.length
          ? sorted.map((piece, index) => (
              <span aria-hidden="true" key={`${piece}-${index}`}>
                {pieceSymbols[color][piece]}
              </span>
            ))
          : '—'}
      </span>
    </div>
  )
}

export function CapturedPieces({ captured, orientation = 'w' }) {
  const advantage = getMaterialAdvantage(captured)
  const colors = getOrientedCapturedColors(orientation)
  const advantageClass = advantage.leader
    ? `captured-advantage captured-advantage--${advantage.leader}`
    : 'captured-advantage captured-advantage--even'

  return (
    <section className="captured-pieces" aria-label="Captured pieces">
      <p className={advantageClass} aria-live="polite">
        <span className="captured-advantage__label">Material</span>
        <strong>{advantage.label}</strong>
      </p>
      {colors.map((color) => (
        <CapturedArmy
          color={color}
          key={color}
          pieces={captured[color]}
        />
      ))}
    </section>
  )
}
