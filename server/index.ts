
import 'dotenv/config'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import tasks from './routes/tasks'
import auth from './routes/auth'
import authenticate from './middleware/authenticate'

const app = express()
const PORT = Number(process.env.PORT) || 5000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student-task-manager'

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

// Used by Docker/CI health checks later.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' })
})

app.use('/api/auth', auth)
app.use('/api/tasks', authenticate, tasks)

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
