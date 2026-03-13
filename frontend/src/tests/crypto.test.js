import { describe, it, expect } from 'vitest'
import { WORDLIST, WORDSET } from '../crypto/wordlist.js'
import { generatePhrase, phraseToString, validatePhrase } from '../crypto/keygen.js'
import {
  encrypt, decrypt, encryptFile, decryptFile,
  randomNonce, randomFileKey, randomSalt, toB64, fromB64,
} from '../crypto/cipher.js'

// ── Wordlist ───────────────────────────────────────────────────────────────

describe('WORDLIST', () => {
  it('has exactly 2048 entries', () => {
    expect(WORDLIST.length).toBe(2048)
  })

  it('has no duplicates', () => {
    expect(new Set(WORDLIST).size).toBe(2048)
  })
})

// ── keygen ─────────────────────────────────────────────────────────────────

describe('generatePhrase()', () => {
  it('returns exactly 12 words', () => {
    const p = generatePhrase()
    expect(p).toHaveLength(12)
  })

  it('all words are from the wordlist', () => {
    const p = generatePhrase()
    for (const w of p) expect(WORDSET.has(w)).toBe(true)
  })

  it('two calls produce different phrases (probabilistic)', () => {
    const a = generatePhrase().join(' ')
    const b = generatePhrase().join(' ')
    expect(a).not.toBe(b)
  })
})

describe('validatePhrase()', () => {
  it('accepts a valid 12-word phrase', () => {
    const words = generatePhrase()
    expect(validatePhrase(words)).toBe(true)
  })

  it('rejects a phrase with 11 words', () => {
    const words = generatePhrase().slice(0, 11)
    expect(validatePhrase(words)).toBe(false)
  })

  it('rejects a phrase containing an invalid word', () => {
    const words = generatePhrase()
    words[5] = 'notaword'
    expect(validatePhrase(words)).toBe(false)
  })

  it('accepts a phrase as a space-separated string', () => {
    const phrase = generatePhrase().join(' ')
    expect(validatePhrase(phrase)).toBe(true)
  })
})

describe('phraseToString()', () => {
  it('lowercases and trims words', () => {
    expect(phraseToString(['  Abandon ', 'ABILITY'])).toBe('abandon ability')
  })
})

// ── cipher helpers ─────────────────────────────────────────────────────────

describe('toB64 / fromB64 round-trip', () => {
  it('encodes and decodes correctly', () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 255])
    const encoded  = toB64(original)
    expect(fromB64(encoded)).toEqual(original)
  })

  it('uses base64url (no + / = characters)', () => {
    const random = randomNonce()
    const enc = toB64(random)
    expect(enc).not.toMatch(/[+/=]/)
  })
})

// ── Low-level encrypt / decrypt ────────────────────────────────────────────

describe('encrypt() / decrypt()', () => {
  it('decrypts ciphertext back to original plaintext', () => {
    const key       = randomFileKey()
    const nonce     = randomNonce()
    const plaintext = new TextEncoder().encode('hello world')

    const { ciphertext } = encrypt(key, plaintext, nonce)
    const recovered      = decrypt(key, ciphertext, nonce)

    expect(Array.from(recovered)).toEqual(Array.from(plaintext))
  })

  it('throws on wrong key', () => {
    const key1  = randomFileKey()
    const key2  = randomFileKey()
    const nonce = randomNonce()
    const { ciphertext } = encrypt(key1, new Uint8Array([1, 2, 3]), nonce)
    expect(() => decrypt(key2, ciphertext, nonce)).toThrow()
  })

  it('throws on corrupted ciphertext', () => {
    const key   = randomFileKey()
    const nonce = randomNonce()
    const { ciphertext } = encrypt(key, new Uint8Array([1, 2, 3]), nonce)
    // Flip a byte
    const corrupted = new Uint8Array(ciphertext)
    corrupted[0] ^= 0xff
    expect(() => decrypt(key, corrupted, nonce)).toThrow()
  })

  it('throws on wrong nonce', () => {
    const key     = randomFileKey()
    const nonce1  = randomNonce()
    const nonce2  = randomNonce()
    const { ciphertext } = encrypt(key, new Uint8Array([42]), nonce1)
    expect(() => decrypt(key, ciphertext, nonce2)).toThrow()
  })
})

// ── encryptFile / decryptFile ──────────────────────────────────────────────

describe('encryptFile() / decryptFile()', () => {
  it('full round-trip restores file bytes and name', () => {
    const derivedKey = randomFileKey() // simulate output of Argon2id
    const original   = new TextEncoder().encode('The quick brown fox')
    const name       = 'test.txt'

    const { fileCiphertext, metadata } = encryptFile(derivedKey, original, name)
    const { fileBytes, fileName }      = decryptFile(derivedKey, fileCiphertext, metadata)

    expect(Array.from(fileBytes)).toEqual(Array.from(original))
    expect(fileName).toBe(name)
  })

  it('throws on wrong derived key', () => {
    const right = randomFileKey()
    const wrong = randomFileKey()
    const { fileCiphertext, metadata } = encryptFile(right, new Uint8Array([1, 2, 3]), 'f')
    expect(() => decryptFile(wrong, fileCiphertext, metadata)).toThrow()
  })

  it('throws on corrupted ciphertext', () => {
    const key = randomFileKey()
    const { fileCiphertext, metadata } = encryptFile(key, new Uint8Array([1, 2, 3]), 'f')
    const corrupted = new Uint8Array(fileCiphertext)
    corrupted[10] ^= 0xab
    expect(() => decryptFile(key, corrupted, metadata)).toThrow()
  })

  it('ciphertext is longer than plaintext (AEAD tag overhead)', () => {
    const key  = randomFileKey()
    const data = new Uint8Array(100)
    const { fileCiphertext } = encryptFile(key, data, 'x')
    // XChaCha20-Poly1305 adds 16-byte tag
    expect(fileCiphertext.length).toBeGreaterThan(data.length)
  })
})

// ── Argon2id (integration, requires hash-wasm WASM) ───────────────────────

// Imported separately to avoid top-level await issues in test runner
import { deriveKey } from '../crypto/argon2.js'

describe('deriveKey() (Argon2id)', () => {
  it('same inputs produce same output', async () => {
    const salt = randomSalt()
    const k1 = await deriveKey('one two three', salt)
    const k2 = await deriveKey('one two three', salt)
    expect(k1).toEqual(k2)
  }, 15_000)

  it('different salt produces different key', async () => {
    const s1 = randomSalt()
    const s2 = randomSalt()
    const k1 = await deriveKey('same phrase', s1)
    const k2 = await deriveKey('same phrase', s2)
    expect(k1).not.toEqual(k2)
  }, 20_000)

  it('different phrase produces different key', async () => {
    const salt = randomSalt()
    const k1 = await deriveKey('phrase one', salt)
    const k2 = await deriveKey('phrase two', salt)
    expect(k1).not.toEqual(k2)
  }, 20_000)

  it('output is 32 bytes', async () => {
    const k = await deriveKey('test', randomSalt())
    expect(k.length).toBe(32)
  }, 15_000)
})
