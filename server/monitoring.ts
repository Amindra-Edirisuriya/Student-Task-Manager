import client from 'prom-client'
import type { RequestHandler } from 'express'

const register = new client.Registry()

client.collectDefaultMetrics({ register })

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of completed HTTP requests.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

export const collectHttpMetrics: RequestHandler = (req, res, next) => {
  if (req.path === '/metrics') {
    next()
    return
  }

  const startedAt = process.hrtime.bigint()
  res.once('finish', () => {
    const route = req.route
      ? `${req.baseUrl}${req.route.path}`
      : req.path.startsWith('/api/')
        ? 'unmatched'
        : 'other'
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    }

    httpRequests.inc(labels)
    httpRequestDuration.observe(labels, Number(process.hrtime.bigint() - startedAt) / 1e9)
  })

  next()
}

export async function renderMetrics() {
  return register.metrics()
}
