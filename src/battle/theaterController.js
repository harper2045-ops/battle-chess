/**
 * Exactly-once playback lifecycle. Unmount completion is deferred one microtask
 * so React Strict Mode can cancel its setup/cleanup simulation with mount().
 */
export function createTheaterController({ duration, onComplete }) {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error('Theater duration must be a non-negative finite number')
  }

  let elapsed = 0
  let completed = false
  let unmountPending = false

  function complete() {
    if (completed) return
    completed = true
    unmountPending = false
    onComplete()
  }

  return {
    mount() {
      unmountPending = false
    },

    tick(delta) {
      if (completed) return
      elapsed = Math.min(duration, elapsed + Math.max(0, delta))
      if (elapsed >= duration) complete()
    },

    skip() {
      complete()
    },

    unmount() {
      if (completed || unmountPending) return
      unmountPending = true
      queueMicrotask(() => {
        if (unmountPending) complete()
      })
    },

    getState() {
      return { elapsed, completed }
    },
  }
}
