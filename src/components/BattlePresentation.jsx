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
  return (
    <div className="captured-army">
      <span className="captured-army__label">
        {colorNames[color]} losses
      </span>
      <span
        className="captured-army__pieces"
        aria-label={
          pieces.length
            ? pieces.map((piece) => pieceNames[piece]).join(', ')
            : 'None'
        }
      >
        {pieces.length
          ? pieces.map((piece, index) => (
              <span aria-hidden="true" key={`${piece}-${index}`}>
                {pieceSymbols[color][piece]}
              </span>
            ))
          : '—'}
      </span>
    </div>
  )
}

export function CapturedPieces({ captured }) {
  return (
    <section className="captured-pieces" aria-label="Captured pieces">
      <CapturedArmy color="w" pieces={captured.w} />
      <CapturedArmy color="b" pieces={captured.b} />
    </section>
  )
}
