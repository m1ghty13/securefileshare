import { mkdirSync, existsSync, unlinkSync, createReadStream, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { CONFIG } from '../config.js'

export function ensureStorageDir(dir) {
  const target = dir ?? CONFIG.STORAGE_DIR
  if (!existsSync(target)) mkdirSync(target, { recursive: true })
}

/**
 * Save a file stream to disk. Returns the absolute storage path.
 */
export async function saveFile(id, readableStream, storageDir) {
  const dir = storageDir ?? CONFIG.STORAGE_DIR
  const fullPath = join(dir, id)
  const ws = createWriteStream(fullPath)
  await pipeline(readableStream, ws)
  return fullPath
}

/**
 * Returns a readable stream for the stored file.
 */
export function openFile(storagePath) {
  return createReadStream(storagePath)
}

/**
 * Delete stored ciphertext file; silently ignores missing files.
 */
export function deleteStoredFile(storagePath) {
  try {
    if (storagePath && existsSync(storagePath)) unlinkSync(storagePath)
  } catch {
    // silent — best effort
  }
}
