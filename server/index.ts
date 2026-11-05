import 'dotenv/config'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import tasks from './routes/tasks'
import auth from './routes/auth'
import authenticate from './middleware/authenticate'
import { collectHttpMetrics, renderMetrics } from './monitoring'

const app = express()
const PORT = Number(process.env.PORT) || 5000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student-task-manager'

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(collectHttpMetrics)
app.use(express.json())

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  res.end(await renderMetrics())
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' })
})

app.use('/api/auth', auth)
app.use('/api/tasks', authenticate, tasks)

if (process.env.DEMO_MODE === 'true') {
  let cpuSimulationRunning = false
  let memorySimulation: Uint8Array | undefined

  app.get('/api/demo/error', (_req, res) => {
    res.status(500).json({ message: 'Demonstration HTTP 500 error' })
  })

  app.get('/api/demo/cpu', async (req, res) => {
    const seconds = Number(req.query.seconds)
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120) {
      res.status(400).json({ message: 'seconds must be an integer from 1 to 120' })
      return
    }
    if (cpuSimulationRunning) {
      res.status(409).json({ message: 'A CPU demonstration is already running' })
      return
    }

    cpuSimulationRunning = true
    const endsAt = Date.now() + seconds * 1000
    let value = 0
    try {
      while (Date.now() < endsAt) {
        const sliceEndsAt = Math.min(endsAt, Date.now() + 25)
        while (Date.now() < sliceEndsAt) value = Math.imul(value + 1, 1664525)
        await new Promise<void>((resolve) => setImmediate(resolve))
      }
      res.json({ status: 'complete', seconds, value })
    } finally {
      cpuSimulationRunning = false
    }
  })

  app.get('/api/demo/memory', (req, res) => {
    const megabytes = Number(req.query.megabytes)
    const seconds = Number(req.query.seconds)
    if (!Number.isInteger(megabytes) || megabytes < 1 || megabytes > 128) {
      res.status(400).json({ message: 'megabytes must be an integer from 1 to 128' })
      return
    }
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120) {
      res.status(400).json({ message: 'seconds must be an integer from 1 to 120' })
      return
    }
    if (memorySimulation) {
      res.status(409).json({ message: 'A memory demonstration is already running' })
      return
    }

    memorySimulation = new Uint8Array(megabytes * 1024 * 1024)
    memorySimulation.fill(1)
    setTimeout(() => {
      memorySimulation = undefined
    }, seconds * 1000)
    res.json({ status: 'running', megabytes, seconds })
  })
}

// Express 5 forwards errors from async handlers here automatically.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e: any) => e.message).join(', ') })
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid value for ${err.path}` })
  if (err.code === 11000) return res.status(409).json({ message: 'An account with that email already exists' })
  console.error(err)
  res.status(500).json({ message: 'Server error' })
})

mongoose
  .connect(MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
