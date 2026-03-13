import 'dotenv/config'

export const CONFIG = {
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  HOST: process.env.HOST ?? '0.0.0.0',

  // 200 MB default
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE ?? String(200 * 1024 * 1024), 10),

  STORAGE_DIR: process.env.STORAGE_DIR ?? '/data/uploads',
  DB_PATH: process.env.DB_PATH ?? '/data/db.sqlite',

  // Cleanup worker interval ms
  CLEANUP_INTERVAL_MS: parseInt(process.env.CLEANUP_INTERVAL_MS ?? '60000', 10),

  // In-memory rate limiting
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX ?? '20', 10),
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW ?? '1 minute',

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',

  // Never log IPs/tokens in production; enable only for local dev
  DEV_MODE: process.env.DEV_MODE === 'true',
}
