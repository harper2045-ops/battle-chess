import { beforeEach, describe, expect, it, vi } from 'vitest'

class MockWorker {
  static instances = []

  constructor(url) {
    this.url = url
    this.listeners = new Set()
    this.messages = []
    MockWorker.instances.push(this)
  }

  addEventListener(type, listener) {
    if (type === 'message') this.listeners.add(listener)
  }

  removeEventListener(type, listener) {
    if (type === 'message') this.listeners.delete(listener)
  }

  postMessage(message) {
    this.messages.push(message)
  }

  emit(message) {
    for (const listener of [...this.listeners]) {
      listener({ data: message })
    }
  }
}

describe('Stockfish engine', () => {
  beforeEach(() => {
    vi.resetModules()
    MockWorker.instances = []
    vi.stubGlobal('Worker', MockWorker)
  })

  it('sends the position and requested depth, then resolves a bot move', async () => {
    const { getStockfishMove } = await import('./stockfishEngine.js')
    const fen = 'start-position-fen'

    const movePromise = getStockfishMove(fen, 15)
    const worker = MockWorker.instances[0]

    expect(worker.url).toBe('/stockfish/stockfish-18-lite-single.js')
    expect(worker.messages).toEqual([
      `position fen ${fen}`,
      'go depth 15',
    ])

    worker.emit('info depth 15')
    worker.emit('bestmove e7e8q ponder a2a3')

    await expect(movePromise).resolves.toBe('e7e8q')
    expect(worker.listeners.size).toBe(0)
  })

  it('uses the default depth and rejects when Stockfish has no move', async () => {
    const { getStockfishMove } = await import('./stockfishEngine.js')

    const movePromise = getStockfishMove('finished-position')
    const worker = MockWorker.instances[0]

    expect(worker.messages.at(-1)).toBe('go depth 10')
    worker.emit('bestmove (none)')

    await expect(movePromise).rejects.toThrow('Stockfish returned no move')
    expect(worker.listeners.size).toBe(0)
  })
})
