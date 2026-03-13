// Cleanup worker tests using the built-in node:test runner
// Run with: node --test tests/cleanup.test.js
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { initDB, closeDB, getDB } from '../src/db/database.js'
import { runCleanup } from '../src/worker/cleanup.js'

const TEST_DIR = './test_cleanup_tmp'
const TEST_STORAGE = join(TEST_DIR, 'uploads')

function seed(overrides = {}) {
  const db = getDB()
  const id = randomBytes(8).toString('hex')
  const sp = join(TEST_STORAGE, id)
  writeFileSync(sp, 'data')
  const now = Math.floor(Date.now() / 1000)
  db.prepare(`
    INSERT INTO files
      (id, upload_token, status, salt, nonce_file, nonce_wrap, wrapped_key,
       nonce_name, encrypted_name, file_size, expires_at, max_downloads,
       downloads_remaining, created_at, storage_path)
    VALUES
      (@id, @ut, @st, 's', 'nf', 'nw', 'wk', 'nn', 'en',
       10, @ea, 1, @dr, @ca, @sp)
  `).run({
    id, ut: id + '_token', st: overrides.status ?? 'ready',
    ea: overrides.expires_at ?? now + 3600,
    dr: overrides.downloads_remaining ?? 1,
    ca: overrides.created_at ?? now,
    sp,
  })
  return { id, sp }
}

beforeEach(() => {
  mkdirSync(TEST_STORAGE, { recursive: true })
  initDB(join(TEST_DIR, 'test.sqlite'))
})

afterEach(() => {
  closeDB()
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('runCleanup()', () => {
  it('removes expired files from disk and DB', () => {
    const past = Math.floor(Date.now() / 1000) - 1
    const { id, sp } = seed({ expires_at: past })
    runCleanup()
    assert.equal(existsSync(sp), false)
    const row = getDB().prepare('SELECT status FROM files WHERE id = @id').get({ id })
    assert.equal(row.status, 'deleted')
  })

  it('removes files with depleted download counter', () => {
    const { id, sp } = seed({ downloads_remaining: 0 })
    runCleanup()
    assert.equal(existsSync(sp), false)
    const row = getDB().prepare('SELECT status FROM files WHERE id = @id').get({ id })
    assert.equal(row.status, 'deleted')
  })

  it('leaves valid files untouched', () => {
    const future = Math.floor(Date.now() / 1000) + 9999
    const { id, sp } = seed({ expires_at: future, downloads_remaining: 1 })
    runCleanup()
    assert.equal(existsSync(sp), true)
    const row = getDB().prepare('SELECT status FROM files WHERE id = @id').get({ id })
    assert.equal(row.status, 'ready')
  })

  it('cleans stale pending uploads older than 1 hour', () => {
    const oldTime = Math.floor(Date.now() / 1000) - 7200
    const { id } = seed({ status: 'pending', created_at: oldTime, expires_at: Date.now() / 1000 + 9999 })
    runCleanup()
    const row = getDB().prepare('SELECT status FROM files WHERE id = @id').get({ id })
    assert.equal(row.status, 'deleted')
  })

  it('returns counts of what was cleaned', () => {
    const past = Math.floor(Date.now() / 1000) - 1
    seed({ expires_at: past })
    seed({ downloads_remaining: 0 })
    const result = runCleanup()
    assert.ok(result.expired >= 1)
    assert.ok(result.depleted >= 1)
  })
})

