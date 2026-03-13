import { getDB } from '../db/database.js'
import { deleteStoredFile } from '../storage/fileStorage.js'
import { CONFIG } from '../config.js'

function deleteRecord(row) {
  const db = getDB()
  deleteStoredFile(row.storage_path)
  db.prepare(
    "UPDATE files SET status = 'deleted', storage_path = NULL WHERE id = @id"
  ).run({ id: row.id })
}

export function runCleanup() {
  const db = getDB()
  const now = Math.floor(Date.now() / 1000)

  // Expired files
  const expired = db.prepare(
    "SELECT id, storage_path FROM files WHERE status = 'ready' AND expires_at <= @now"
  ).all({ now })

  // Depleted download counters
  const depleted = db.prepare(
    "SELECT id, storage_path FROM files WHERE status = 'ready' AND downloads_remaining <= 0"
  ).all()

  // Stale pending uploads older than 1 hour
  const stale = db.prepare(
    "SELECT id, storage_path FROM files WHERE status = 'pending' AND created_at <= @cutoff"
  ).all({ cutoff: now - 3600 })

  for (const row of [...expired, ...depleted, ...stale]) {
    deleteRecord(row)
  }

  return { expired: expired.length, depleted: depleted.length, stale: stale.length }
}

let timer

export function startCleanupWorker() {
  timer = setInterval(runCleanup, CONFIG.CLEANUP_INTERVAL_MS)
  // Unref so the worker doesn't keep the process alive during tests
  if (timer.unref) timer.unref()
}

export function stopCleanupWorker() {
  if (timer) clearInterval(timer)
}
