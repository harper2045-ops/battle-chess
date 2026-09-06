/**
 * App-level keyboard shortcuts for Battle Chess.
 * Pure helpers so mapping stays testable and out of App.jsx.
 *
 * - Ctrl/Cmd+Z — undo
 * - Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z — redo
 * - F — flip board
 * - Escape — clear square selection (when nothing modal is open)
 */

export const SHORTCUT_ACTIONS = Object.freeze({
  undo: 'undo',
  redo: 'redo',
  flip: 'flip',
  clearSelection: 'clearSelection',
})

/** True when focus is in a field that should keep its own key bindings. */
export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false

  const tag = String(target.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true

  return Boolean(target.closest?.('[contenteditable="true"]'))
}

/** True when a modal dialog (promotion, credits, …) owns Escape / keys. */
export function hasOpenModal(root) {
  if (!root || typeof root.querySelector !== 'function') return false
  return Boolean(root.querySelector('[aria-modal="true"]'))
}

/**
 * Map a keyboard event to a shortcut action id, or null.
 *
 * @param {Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'defaultPrevented' | 'target'>} event
 * @param {{ hasSelection?: boolean, modalOpen?: boolean, root?: ParentNode | null }} [options]
 * @returns {keyof typeof SHORTCUT_ACTIONS | null}
 */
export function resolveKeyboardShortcut(event, options = {}) {
  const { hasSelection = false, modalOpen = false, root = null } = options

  if (event.defaultPrevented) return null
  if (modalOpen || hasOpenModal(root)) return null
  if (isEditableTarget(event.target)) return null

  const key = event.key
  const lower = key.length === 1 ? key.toLowerCase() : key
  const mod = event.ctrlKey || event.metaKey

  if (mod && !event.altKey) {
    if (lower === 'z' && !event.shiftKey) return SHORTCUT_ACTIONS.undo
    if (lower === 'y' || (lower === 'z' && event.shiftKey)) {
      return SHORTCUT_ACTIONS.redo
    }
    return null
  }

  if (event.altKey || event.ctrlKey || event.metaKey) return null

  if (lower === 'f') return SHORTCUT_ACTIONS.flip
  if (key === 'Escape' && hasSelection) return SHORTCUT_ACTIONS.clearSelection

  return null
}

/** Short discoverability copy for screen readers / title attributes. */
export function shortcutHintLabel(action) {
  switch (action) {
    case SHORTCUT_ACTIONS.undo:
      return 'Ctrl or ⌘ Z'
    case SHORTCUT_ACTIONS.redo:
      return 'Ctrl or ⌘ Y'
    case SHORTCUT_ACTIONS.flip:
      return 'F'
    case SHORTCUT_ACTIONS.clearSelection:
      return 'Escape'
    default:
      return ''
  }
}
