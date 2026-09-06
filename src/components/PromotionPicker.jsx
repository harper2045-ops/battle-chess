import { useEffect, useId, useRef } from 'react'
import { promotionChoicesFor } from '../game/promotion.js'

/**
 * Modal to pick a promotion piece. Uses Ivory Kingdom names alongside
 * standard chess labels so the fantasy army stays legible.
 */
export function PromotionPicker({ color, options, onChoose, onCancel }) {
  const titleId = useId()
  const firstChoiceRef = useRef(null)
  const choices = promotionChoicesFor(options)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    firstChoiceRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="promotion-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="promotion-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="promotion-dialog__header">
          <h2 id={titleId}>Promote footman</h2>
          <button aria-label="Cancel promotion" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
        <p className="promotion-dialog__hint">
          Choose the Ivory piece that takes the field.
        </p>
        <div
          aria-label="Promotion choices"
          className="promotion-dialog__choices"
          role="group"
        >
          {choices.map((choice, index) => (
            <button
              key={choice.type}
              aria-label={`Promote to ${choice.chessName} (${choice.ivoryName})`}
              className="promotion-choice"
              onClick={() => onChoose(choice.type)}
              ref={index === 0 ? firstChoiceRef : undefined}
              type="button"
            >
              <span aria-hidden="true" className="promotion-choice__symbol">
                {choice.symbol[color]}
              </span>
              <span className="promotion-choice__ivory">{choice.ivoryName}</span>
              <span className="promotion-choice__chess">{choice.chessName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
