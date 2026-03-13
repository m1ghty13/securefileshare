import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { createHash } from 'node:crypto'
import { CONFIG } from './config.js'
import uploadRoutes from './routes/upload.js'
import fileRoutes from './routes/files.js'
import { initDB } from './db/database.js'
import { ensureStorageDir } from './storage/fileStorage.js'
import { startCleanupWorker } from './worker/cleanup.js'

export async function buildApp(opts = {}) {
  const app = Fastify({
    // Only enable structured logs in DEV_MODE — never log IPs or tokens in production
    logger: opts.logger ?? (CONFIG.DEV_MODE
      ? { level: 'info', redact: ['req.headers.authorization', 'req.remoteAddress'] }
      : false),
    maxParamLength: 200,
    trustProxy: true,
  })

  await app.register(cors, {
    origin: opts.corsOrigin ?? CONFIG.CORS_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
  })

  // Rate limit per hashed IP — never store or log raw IP
  await app.register(rateLimit, {
    max: CONFIG.RATE_LIMIT_MAX,
    timeWindow: CONFIG.RATE_LIMIT_WINDOW,
    keyGenerator: (req) =>
      createHash('sha256').update(req.ip ?? 'unknown').digest('hex').slice(0, 16),
    errorResponseBuilder: () => ({
      error: 'Too many requests — slow down',
    }),
    // Suppress rate-limit log messages
    addHeaders: {
      'x-ratelimit-limit': false,
      'x-ratelimit-remaining': false,
      'x-ratelimit-reset': false,
    },
  })

  await app.register(multipart, {
    limits: {
      fileSize: CONFIG.MAX_FILE_SIZE + 4096, // plaintext + AEAD overhead
      files: 1,
      fields: 0,
    },
  })

  // Health check — publicly accessible
  app.get('/health', async () => ({ ok: true }))

  app.register(uploadRoutes, { prefix: '/api/upload' })
  app.register(fileRoutes, { prefix: '/api/file' })

  // Generic error handler — never expose stack traces
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode ?? 500
    reply.code(status).send({ error: err.message ?? 'Internal server error' })
  })

  return app
}

// Boot only when run directly, not when imported by tests
const isMain = process.argv[1]?.endsWith('server.js')
if (isMain) {
  initDB()
  ensureStorageDir()
  startCleanupWorker()

  const app = await buildApp()
  await app.listen({ port: CONFIG.PORT, host: CONFIG.HOST })
  // eslint-disable-next-line no-console
  if (CONFIG.DEV_MODE) console.log(`XivoraShare backend on :${CONFIG.PORT}`)
}
