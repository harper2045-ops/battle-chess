let worker = null

export function getStockfishMove(fen, depth = 10) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      worker = new Worker(
        '/stockfish/stockfish-18-lite-single.js'
      )
    }

    const handleMessage = (event) => {
      const message = String(event.data)

      if (message.startsWith('bestmove')) {
        worker.removeEventListener('message', handleMessage)

        const move = message.split(' ')[1]

        if (!move || move === '(none)') {
          reject(new Error('Stockfish returned no move'))
          return
        }

        resolve(move)
      }
    }

    worker.addEventListener('message', handleMessage)

    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${depth}`)
  })
}