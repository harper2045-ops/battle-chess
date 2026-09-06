import { describe, expect, it } from 'vitest'
import {
  hasOpenModal,
  isEditableTarget,
  resolveKeyboardShortcut,
  shortcutHintLabel,
  SHORTCUT_ACTIONS,
} from './keyboardShortcuts.js'

function keyEvent(partial) {
  return {
    key: 'a',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    target: { tagName: 'BODY' },
    ...partial,
  }
}

describe('isEditableTarget', () => {
  it('treats form fields and contenteditable as editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(
      true,
    )
  })

  it('ignores ordinary elements', () => {
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isEditableTarget({ tagName: 'BODY' })).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('hasOpenModal', () => {
  it('detects aria-modal dialogs', () => {
    const root = {
      querySelector: (sel) =>
        sel === '[aria-modal="true"]' ? { role: 'dialog' } : null,
    }
    expect(hasOpenModal(root)).toBe(true)
    expect(hasOpenModal({ querySelector: () => null })).toBe(false)
    expect(hasOpenModal(null)).toBe(false)
  })
})

describe('resolveKeyboardShortcut', () => {
  it('maps undo / redo chords on Ctrl and Meta', () => {
    expect(
      resolveKeyboardShortcut(keyEvent({ key: 'z', ctrlKey: true })),
    ).toBe(SHORTCUT_ACTIONS.undo)
    expect(
      resolveKeyboardShortcut(keyEvent({ key: 'Z', metaKey: true })),
    ).toBe(SHORTCUT_ACTIONS.undo)
    expect(
      resolveKeyboardShortcut(keyEvent({ key: 'y', ctrlKey: true })),
    ).toBe(SHORTCUT_ACTIONS.redo)
    expect(
      resolveKeyboardShortcut(
        keyEvent({ key: 'z', metaKey: true, shiftKey: true }),
      ),
    ).toBe(SHORTCUT_ACTIONS.redo)
  })

  it('maps F to flip and Escape to clear selection', () => {
    expect(resolveKeyboardShortcut(keyEvent({ key: 'f' }))).toBe(
      SHORTCUT_ACTIONS.flip,
    )
    expect(resolveKeyboardShortcut(keyEvent({ key: 'F' }))).toBe(
      SHORTCUT_ACTIONS.flip,
    )
    expect(
      resolveKeyboardShortcut(keyEvent({ key: 'Escape' }), {
        hasSelection: true,
      }),
    ).toBe(SHORTCUT_ACTIONS.clearSelection)
    expect(resolveKeyboardShortcut(keyEvent({ key: 'Escape' }))).toBe(null)
  })

  it('ignores shortcuts while typing, in modals, or after preventDefault', () => {
    expect(
      resolveKeyboardShortcut(
        keyEvent({ key: 'z', ctrlKey: true, target: { tagName: 'INPUT' } }),
      ),
    ).toBe(null)
    expect(
      resolveKeyboardShortcut(keyEvent({ key: 'f' }), { modalOpen: true }),
    ).toBe(null)
    expect(
      resolveKeyboardShortcut(keyEvent({ key: 'f' }), {
        root: { querySelector: () => ({}) },
      }),
    ).toBe(null)
    expect(
      resolveKeyboardShortcut(
        keyEvent({ key: 'z', ctrlKey: true, defaultPrevented: true }),
      ),
    ).toBe(null)
    expect(
      resolveKeyboardShortcut(keyEvent({ key: 'f', altKey: true })),
    ).toBe(null)
  })
})

describe('shortcutHintLabel', () => {
  it('returns human-readable chord labels', () => {
    expect(shortcutHintLabel(SHORTCUT_ACTIONS.undo)).toBe('Ctrl or ⌘ Z')
    expect(shortcutHintLabel(SHORTCUT_ACTIONS.redo)).toBe('Ctrl or ⌘ Y')
    expect(shortcutHintLabel(SHORTCUT_ACTIONS.flip)).toBe('F')
    expect(shortcutHintLabel(SHORTCUT_ACTIONS.clearSelection)).toBe('Escape')
    expect(shortcutHintLabel('nope')).toBe('')
  })
})
