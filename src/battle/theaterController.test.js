import { describe, expect, it, vi } from 'vitest'
import { createTheaterController } from './theaterController.js'

describe('theaterController', () => {
  it('completes naturally exactly once', () => {
    const onComplete = vi.fn()
    const controller = createTheaterController({ duration: 2, onComplete })
    controller.mount()
    controller.tick(0.5)
    controller.tick(1.5)
    controller.tick(1)
    controller.skip()
    controller.unmount()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toEqual({ elapsed: 2, completed: true })
  })

  it('completes on skip exactly once', () => {
    const onComplete = vi.fn()
    const controller = createTheaterController({ duration: 4, onComplete })
    controller.mount()
    controller.skip()
    controller.skip()
    controller.tick(4)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('completes on a real unmount exactly once', async () => {
    const onComplete = vi.fn()
    const controller = createTheaterController({ duration: 4, onComplete })
    controller.mount()
    controller.unmount()
    controller.unmount()
    controller.tick(4)
    await Promise.resolve()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('cancels a simulated unmount when Strict Mode remounts immediately', async () => {
    const onComplete = vi.fn()
    const controller = createTheaterController({ duration: 4, onComplete })
    controller.mount()
    controller.unmount()
    controller.mount()
    await Promise.resolve()
    expect(onComplete).not.toHaveBeenCalled()
    controller.tick(4)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('ignores negative frame deltas and completes a zero-duration script once', () => {
    const onComplete = vi.fn()
    const controller = createTheaterController({ duration: 0, onComplete })
    controller.mount()
    controller.tick(-1)
    expect(controller.getState().elapsed).toBe(0)
    controller.tick(0)
    controller.unmount()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
