
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export default function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  const token = authorization.slice(7)

  try {
    const payload = jwt.verify(token, JWT_SECRET)

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      return res.status(401).json({ message: 'Invalid authentication token' })
    }

    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
