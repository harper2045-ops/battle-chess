#!/usr/bin/env node
// Watches for GLB file changes and triggers a full page reload via Vite's HMR WebSocket.
// Run with: npm run dev:models (in a separate terminal from npm run dev)

import { watch } from 'chokidar'
import WebSocket from 'ws'

const MODELS_DIR = 'public/models'
const VITE_HMR_URL = 'ws://localhost:5173'

console.log('Watching for GLB changes in', MODELS_DIR)
console.log('Connecting to Vite HMR at', VITE_HMR_URL)

let ws
try {
  ws = new WebSocket(VITE_HMR_URL)
} catch (e) {
  console.error('Could not connect to Vite HMR. Is `npm run dev` running?')
  console.error(e.message)
  process.exit(1)
}

ws.on('open', () => {
  console.log('Connected to Vite HMR')
})

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message)
})

function triggerReload(changedFile) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('GLB changed:', changedFile)
    ws.send(
      JSON.stringify({
        type: 'full-reload',
        path: '*',
        timestamp: Date.now(),
      })
    )
    console.log('Reload signal sent')
  }
}

const watcher = watch(MODELS_DIR, {
  ignored: /(^|[/\\])\../, // ignore dotfiles
  persistent: true,
})

watcher.on('change', (path) => {
  if (path.endsWith('.glb')) {
    triggerReload(path)
  }
})

watcher.on('add', (path) => {
  if (path.endsWith('.glb')) {
    triggerReload(path)
  }
})

watcher.on('unlink', (path) => {
  if (path.endsWith('.glb')) {
    triggerReload(path)
  }
})

process.on('SIGINT', () => {
  console.log('Stopping watcher...')
  watcher.close()
  ws.close()
  process.exit(0)
})
