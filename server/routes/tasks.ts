
import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import Task from '../models/Task'

const router = Router()
const FIELDS = ['title', 'description', 'dueDate', 'priority', 'status']

const pick = (body: Record<string, unknown> = {}) =>
  Object.fromEntries(
    FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]),
  )

router.get('/', async (req, res) => {
  const tasks = await Task.find({ userId: req.userId }).sort({ createdAt: -1 })
  res.json(tasks)
})

router.post('/', async (req, res) => {
  const task = await Task.create({
    ...pick(req.body),
    userId: req.userId,
  })

  res.status(201).json(task)
})

router.put('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    pick(req.body),
    { new: true, runValidators: true },
  )

  if (!task) return res.status(404).json({ message: 'Task not found' })

  res.json(task)
})

router.delete('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  const task = await Task.findOneAndDelete({
    _id: req.params.id,
    userId: req.userId,
  })

  if (!task) return res.status(404).json({ message: 'Task not found' })

  res.status(204).end()
})

export default router
