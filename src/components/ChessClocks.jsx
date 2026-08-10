import { formatClock, TIME_CONTROLS } from '../game/clock.js'

const colorNames = { w: 'White', b: 'Black' }

function Clock({ color, state }) {
  const active = state.running && state.activeColor === color
  const timedOut = state.timedOutColor === color

  return (
    <div
      className={`chess-clock${active ? ' chess-clock--active' : ''}${timedOut ? ' chess-clock--timeout' : ''}`}
      aria-label={`${colorNames[color]} clock ${formatClock(state.remainingMs[color])}`}
    >
      <span>{colorNames[color]}</span>
      <strong>{formatClock(state.remainingMs[color])}</strong>
    </div>
  )
}

export function ChessClocks({ orientation, state }) {
  const colors = orientation === 'w' ? ['b', 'w'] : ['w', 'b']

  return (
    <section className="chess-clocks" aria-label="Chess clocks">
      {colors.map((color) => (
        <Clock color={color} key={color} state={state} />
      ))}
    </section>
  )
}

export function TimeControlPicker({ selected, onChange }) {
  return (
    <fieldset className="time-controls">
      <legend>Time control</legend>
      {TIME_CONTROLS.map((control) => (
        <button
          aria-pressed={selected === control.id}
          key={control.id}
          onClick={() => onChange(control.id)}
          type="button"
        >
          {control.label}
        </button>
      ))}
    </fieldset>
  )
}
