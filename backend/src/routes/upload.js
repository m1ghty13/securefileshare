import { randomBytes, createHash } from 'node:crypto'
import { getDB } from '../db/database.js'
import { saveFile } from '../storage/fileStorage.js'
import { CONFIG } from '../config.js'

const EXPIRES_OPTIONS = {
  '10m': 10 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
}

const MAX_DOWNLOADS_ALLOWED = [1, 2, 5]

function generateId(len = 22) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(len)
  return Array.from(bytes, (b) => chars[b % 62]).join('')
}

export default async function uploadRoutes(fastify) {
  /**
   * POST /api/upload/init
   * Creates a pending file record; returns id + upload_token.
   */
  fastify.post('/init', {
    schema: {
      body: {
        type: 'object',
        required: ['salt', 'nonce_file', 'nonce_wrap', 'wrapped_key', 'nonce_name', 'encrypted_name', 'size', 'expires_in', 'max_downloads'],
        properties: {
          salt:           { type: 'string' },
          nonce_file:     { type: 'string' },
          nonce_wrap:     { type: 'string' },
          wrapped_key:    { type: 'string' },
          nonce_name:     { type: 'string' },
          encrypted_name: { type: 'string' },
          size:           { type: 'integer', minimum: 1, maximum: CONFIG.MAX_FILE_SIZE + 4096 },
          expires_in:     { type: 'string', enum: Object.keys(EXPIRES_OPTIONS) },
          max_downloads:  { type: 'integer', enum: MAX_DOWNLOADS_ALLOWED },
        },
      },
    },
  }, async (request, reply) => {
    const {
      salt, nonce_file, nonce_wrap, wrapped_key,
      nonce_name, encrypted_name, size, expires_in, max_downloads,
    } = request.body

    const id = generateId()
    const upload_token = generateId(32)
    const now = Math.floor(Date.now() / 1000)
    const expires_at = now + EXPIRES_OPTIONS[expires_in]

    const db = getDB()
    db.prepare(`
      INSERT INTO files
        (id, upload_token, status, salt, nonce_file, nonce_wrap, wrapped_key,
         nonce_name, encrypted_name, file_size, expires_at, max_downloads,
         downloads_remaining, created_at)
      VALUES
        (@id, @upload_token, 'pending', @salt, @nonce_file, @nonce_wrap, @wrapped_key,
         @nonce_name, @encrypted_name, @file_size, @expires_at, @max_downloads,
         @max_downloads, @created_at)
    `).run({
      id, upload_token, salt, nonce_file, nonce_wrap, wrapped_key,
      nonce_name, encrypted_name, file_size: size,
      expires_at, max_downloads, created_at: now,
    })

    return reply.code(201).send({ id, upload_token })
  })

  /**
   * POST /api/upload/complete/:upload_token
   * Receives raw ciphertext as multipart file part; marks record ready.
   */
  fastify.post('/complete/:upload_token', async (request, reply) => {
    const { upload_token } = request.params
    if (!upload_token || upload_token.length < 10) {
      return reply.code(400).send({ error: 'Invalid upload token' })
    }

    const db = getDB()
    const record = db.prepare(
      "SELECT id, status, file_size FROM files WHERE upload_token = @t"
    ).get({ t: upload_token })

    if (!record) return reply.code(404).send({ error: 'Upload not found' })
    if (record.status !== 'pending') return reply.code(409).send({ error: 'Already uploaded' })

    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'No file part in request' })

    // Enforce size: file_size is the expected ciphertext size (plaintext + AEAD overhead)
    const MAX_ALLOWED = record.file_size + 4096 // allow small AEAD overhead
    if (data.file.readableLength > MAX_ALLOWED) {
      data.file.destroy()
      db.prepare("DELETE FROM files WHERE upload_token = @t").run({ t: upload_token })
      return reply.code(413).send({ error: 'File too large' })
    }

    const storagePath = await saveFile(record.id, data.file)

    db.prepare(
      "UPDATE files SET status = 'ready', storage_path = @sp WHERE id = @id"
    ).run({ sp: storagePath, id: record.id })

    return reply.code(200).send({ id: record.id })
  })
}
