let worker = null
let activeRequest = null

export function cancelStockfishMove() {
  if (!activeRequest) return

  const { handleMessage, reject } = activeRequest
  worker.removeEventListener('message', handleMessage)
  worker.postMessage('stop')
  worker.terminate()
  worker = null
  activeRequest = null
  reject(new DOMException('Stockfish request cancelled', 'AbortError'))
}

export function getStockfishMove(fen, depth = 10) {
  return new Promise((resolve, reject) => {
    cancelStockfishMove()

    if (!worker) {
      worker = new Worker(
        '/stockfish/stockfish-18-lite-single.js'
      )
    }

    const handleMessage = (event) => {
      const message = String(event.data)

      if (message.startsWith('bestmove')) {
        worker.removeEventListener('message', handleMessage)
        activeRequest = null

        const move = message.split(' ')[1]

        if (!move || move === '(none)') {
          reject(new Error('Stockfish returned no move'))
          return
        }

        resolve(move)
      }
    }

    worker.addEventListener('message', handleMessage)
    activeRequest = { handleMessage, reject }

    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${depth}`)
  })
}
