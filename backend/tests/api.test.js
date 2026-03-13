// Backend API tests using the built-in node:test runner
// Run with: node --test tests/api.test.js
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

import { buildApp } from '../src/server.js'
import { initDB, closeDB, getDB } from '../src/db/database.js'
import { ensureStorageDir } from '../src/storage/fileStorage.js'

const TEST_DIR     = './test_api_tmp'
const TEST_DB      = join(TEST_DIR, 'test.sqlite')
const TEST_STORAGE = join(TEST_DIR, 'uploads')

let app

function b64(str) {
  return Buffer.from(str).toString('base64url')
}

function makeMeta(overrides = {}) {
  return {
    salt:           b64('testsalt0000000s'),
    nonce_file:     b64('noncefile0000000000000000'),
    nonce_wrap:     b64('noncewrap0000000000000000'),
    wrapped_key:    b64('wrappedkey000000000000000000000000000000000000000'),
    nonce_name:     b64('noncename0000000000000000'),
    encrypted_name: b64('encname000000000000'),
    size:           100,
    expires_in:     '1h',
    max_downloads:  1,
    ...overrides,
  }
}

function seedReady(max_downloads = 2) {
  const db = getDB()
  const id = randomBytes(8).toString('hex')
  const sp = join(TEST_STORAGE, id)
  writeFileSync(sp, Buffer.alloc(32, 0xff))
  const now = Math.floor(Date.now() / 1000)
  db.prepare(`
    INSERT INTO files
      (id, upload_token, status, salt, nonce_file, nonce_wrap, wrapped_key,
       nonce_name, encrypted_name, file_size, expires_at, max_downloads,
       downloads_remaining, created_at, storage_path)
    VALUES
      (@id, @ut, 'ready', 's', 'nf', 'nw', 'wk', 'nn', 'en',
       32, @ea, @md, @md, @ca, @sp)
  `).run({ id, ut: id + '_t', ea: now + 3600, md: max_downloads, ca: now, sp })
  return id
}

before(async () => {
  mkdirSync(TEST_STORAGE, { recursive: true })
  initDB(TEST_DB)
  ensureStorageDir(TEST_STORAGE)
  app = await buildApp({ corsOrigin: '*' })
  await app.ready()
})

after(async () => {
  await app.close()
  closeDB()
  rmSync(TEST_DIR, { recursive: true, force: true })
})

// в”Ђв”Ђ Health в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().ok, true)
  })
})

// в”Ђв”Ђ Upload init в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe('POST /api/upload/init', () => {
  it('creates pending record and returns id + upload_token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/upload/init', payload: makeMeta() })
    assert.equal(res.statusCode, 201)
    const body = res.json()
    assert.ok(body.id.length > 10)
    assert.ok(body.upload_token.length > 10)
  })

  it('rejects unsupported expires_in', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/upload/init', payload: makeMeta({ expires_in: '7d' }) })
    assert.equal(res.statusCode, 400)
  })

  it('rejects unsupported max_downloads', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/upload/init', payload: makeMeta({ max_downloads: 99 }) })
    assert.equal(res.statusCode, 400)
  })
})

// в”Ђв”Ђ Meta в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe('GET /api/file/:id/meta', () => {
  it('returns metadata for a ready file вЂ” no secrets exposed', async () => {
    const id  = seedReady()
    const res = await app.inject({ method: 'GET', url: `/api/file/${id}/meta` })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.ok('salt' in body)
    assert.ok('wrapped_key' in body)
    assert.ok('downloads_remaining' in body)
    assert.ok(!('storage_path' in body))
    assert.ok(!('upload_token' in body))
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/file/nonexistent_id/meta' })
    assert.equal(res.statusCode, 404)
  })
})

// в”Ђв”Ђ Download в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe('GET /api/file/:id/download', () => {
  it('streams ciphertext with octet-stream content-type', async () => {
    const id  = seedReady()
    const res = await app.inject({ method: 'GET', url: `/api/file/${id}/download` })
    assert.equal(res.statusCode, 200)
    assert.ok(res.headers['content-type'].includes('application/octet-stream'))
    assert.equal(res.rawPayload.length, 32)
  })
})

// в”Ђв”Ђ Confirm в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe('POST /api/file/:id/confirm_download', () => {
  it('decrements downloads_remaining', async () => {
    const id  = seedReady(2)
    const res = await app.inject({ method: 'POST', url: `/api/file/${id}/confirm_download` })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().downloads_remaining, 1)
  })

  it('deletes file after last confirmed download', async () => {
    const id = seedReady(1)
    await app.inject({ method: 'POST', url: `/api/file/${id}/confirm_download` })
    const meta = await app.inject({ method: 'GET', url: `/api/file/${id}/meta` })
    assert.equal(meta.statusCode, 404)
  })
})

// в”Ђв”Ђ Report failed в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe('POST /api/file/:id/report_failed_download', () => {
  it('does NOT decrement downloads_remaining', async () => {
    const id  = seedReady(2)
    const res = await app.inject({ method: 'POST', url: `/api/file/${id}/report_failed_download` })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().downloads_remaining, 2)
    const meta = await app.inject({ method: 'GET', url: `/api/file/${id}/meta` })
    assert.equal(meta.statusCode, 200)
  })
})

