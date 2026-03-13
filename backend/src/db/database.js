// node:sqlite is built-in since Node.js 22.5 (no native compilation needed)
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { CONFIG } from '../config.js'

let db

export function initDB(dbPath) {
  const path = dbPath ?? CONFIG.DB_PATH
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id              TEXT PRIMARY KEY,
      upload_token    TEXT UNIQUE NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',

      -- Argon2id KDF params (salt stored; params fixed server-side)
      salt            TEXT NOT NULL,

      -- XChaCha20-Poly1305 nonces & wrapped key (base64url)
      nonce_file      TEXT NOT NULL,
      nonce_wrap      TEXT NOT NULL,
      wrapped_key     TEXT NOT NULL,

      -- Encrypted file name (so server never knows original name)
      nonce_name      TEXT NOT NULL,
      encrypted_name  TEXT NOT NULL,

      file_size       INTEGER NOT NULL,
      expires_at      INTEGER NOT NULL,
      max_downloads   INTEGER NOT NULL,
      downloads_remaining INTEGER NOT NULL,
      created_at      INTEGER NOT NULL,
      storage_path    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_files_status_expires
      ON files (status, expires_at);

    CREATE INDEX IF NOT EXISTS idx_files_upload_token
      ON files (upload_token);
  `)

  return db
}

export function getDB() {
  if (!db) throw new Error('DB not initialised — call initDB() first')
  return db
}

export function closeDB() {
  try { db?.close() } catch { /* ignore */ }
  db = undefined
}
