import { getDB } from '../db/database.js'
import { openFile, deleteStoredFile } from '../storage/fileStorage.js'
import { createReadStream, statSync } from 'node:fs'

function getReadyFile(id) {
  const db = getDB()
  const now = Math.floor(Date.now() / 1000)
  const row = db.prepare(
    "SELECT * FROM files WHERE id = @id AND status = 'ready'"
  ).get({ id })

  if (!row) return null
  if (row.expires_at <= now) {
    // Auto-clean on access
    _deleteFile(row)
    return null
  }
  if (row.downloads_remaining <= 0) {
    _deleteFile(row)
    return null
  }
  return row
}

function _deleteFile(row) {
  const db = getDB()
  deleteStoredFile(row.storage_path)
  db.prepare("UPDATE files SET status = 'deleted', storage_path = NULL WHERE id = @id").run({ id: row.id })
}

export default async function fileRoutes(fastify) {
  /**
   * GET /api/file/:id/meta
   * Returns all public metadata needed for the client to decrypt.
   * Never returns the raw key — only wrapped_key (encrypted with DerivedKey).
   */
  fastify.get('/:id/meta', async (request, reply) => {
    const row = getReadyFile(request.params.id)
    if (!row) return reply.code(404).send({ error: 'File not found or expired' })

    return reply.send({
      id: row.id,
      salt:           row.salt,
      nonce_file:     row.nonce_file,
      nonce_wrap:     row.nonce_wrap,
      wrapped_key:    row.wrapped_key,
      nonce_name:     row.nonce_name,
      encrypted_name: row.encrypted_name,
      file_size:      row.file_size,
      expires_at:     row.expires_at,
      max_downloads:  row.max_downloads,
      downloads_remaining: row.downloads_remaining,
      created_at:     row.created_at,
    })
  })

  /**
   * GET /api/file/:id/download
   * Streams raw ciphertext. Client decrypts locally.
   */
  fastify.get('/:id/download', async (request, reply) => {
    const row = getReadyFile(request.params.id)
    if (!row) return reply.code(404).send({ error: 'File not found or expired' })
    if (!row.storage_path) return reply.code(503).send({ error: 'Storage unavailable' })

    let stat
    try { stat = statSync(row.storage_path) } catch {
      return reply.code(503).send({ error: 'File missing from storage' })
    }

    reply.header('Content-Type', 'application/octet-stream')
    reply.header('Content-Length', stat.size)
    reply.header('Content-Disposition', 'attachment; filename="encrypted"')
    reply.header('Cache-Control', 'no-store')

    return reply.send(createReadStream(row.storage_path))
  })

  /**
   * POST /api/file/:id/confirm_download
   * Called by client after successful local decryption.
   * Decrements downloads_remaining; deletes file when it reaches 0.
   */
  fastify.post('/:id/confirm_download', async (request, reply) => {
    const row = getReadyFile(request.params.id)
    if (!row) return reply.code(404).send({ error: 'File not found or expired' })

    const db = getDB()
    const remaining = row.downloads_remaining - 1

    if (remaining <= 0) {
      _deleteFile(row)
    } else {
      db.prepare(
        "UPDATE files SET downloads_remaining = @r WHERE id = @id"
      ).run({ r: remaining, id: row.id })
    }

    return reply.send({ ok: true, downloads_remaining: Math.max(0, remaining) })
  })

  /**
   * POST /api/file/:id/report_failed_download
   * Called when client decryption fails (wrong phrase, corrupt data, network error).
   * Does NOT decrement the counter — the download didn't succeed.
   */
  fastify.post('/:id/report_failed_download', async (request, reply) => {
    // Validate file exists but don't change state
    const row = getReadyFile(request.params.id)
    if (!row) return reply.code(404).send({ error: 'File not found or expired' })
    return reply.send({ ok: true, downloads_remaining: row.downloads_remaining })
  })
}
