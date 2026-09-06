import { useEffect, useId, useRef, useState } from 'react'
import { CREDITS_SECTIONS, CREDITS_TITLE } from '../credits.js'

export function CreditsPanel() {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="credits-controls">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        type="button"
      >
        {CREDITS_TITLE}
      </button>

      {open ? (
        <div
          className="credits-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            aria-labelledby={titleId}
            aria-modal="true"
            className="credits-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="credits-dialog__header">
              <h2 id={titleId}>{CREDITS_TITLE}</h2>
              <button
                aria-label="Close credits"
                onClick={() => setOpen(false)}
                ref={closeRef}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="credits-dialog__body">
              {CREDITS_SECTIONS.map((section) => (
                <section key={section.id}>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                  {section.license ? (
                    <p className="credits-dialog__license">
                      License: <strong>{section.license}</strong>
                    </p>
                  ) : null}
                  {section.links.length > 0 ? (
                    <ul>
                      {section.links.map((link) => (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
              <p className="credits-dialog__footnote">
                Full notes live in <code>CREDITS.md</code> in the repository.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
