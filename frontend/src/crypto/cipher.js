import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from '@noble/ciphers/webcrypto'

export const NONCE_SIZE = 24   // XChaCha20 uses a 192-bit nonce
export const KEY_SIZE   = 32   // 256-bit key
export const SALT_SIZE  = 16   // Argon2id salt

/**
 * Base64url encode/decode helpers (no external dep, works in all browsers).
 */
export function toB64(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function fromB64(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = pad + '='.repeat((4 - pad.length % 4) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/**
 * Generate a fresh random nonce (24 bytes).
 */
export function randomNonce() {
  return randomBytes(NONCE_SIZE)
}

/**
 * Generate a fresh random file key (32 bytes).
 */
export function randomFileKey() {
  return randomBytes(KEY_SIZE)
}

/**
 * Generate a fresh Argon2id salt (16 bytes).
 */
export function randomSalt() {
  return randomBytes(SALT_SIZE)
}

/**
 * Encrypt plaintext with XChaCha20-Poly1305.
 * Returns { ciphertext: Uint8Array, nonce: Uint8Array }
 * The AEAD appends a 16-byte Poly1305 authentication tag to the ciphertext.
 */
export function encrypt(key, plaintext, nonceOverride) {
  const nonce = nonceOverride ?? randomNonce()
  const aead = xchacha20poly1305(key, nonce)
  const ciphertext = aead.encrypt(plaintext)
  return { ciphertext, nonce }
}

/**
 * Decrypt ciphertext with XChaCha20-Poly1305.
 * Throws if authentication fails (wrong key or corrupted data).
 */
export function decrypt(key, ciphertext, nonce) {
  const aead = xchacha20poly1305(key, nonce)
  // xchacha20poly1305.decrypt throws on auth failure.
  // Return a detached copy so the buffer/byteOffset are always fresh.
  return new Uint8Array(aead.decrypt(ciphertext))
}

/**
 * Encrypt a file and its name for upload.
 *
 * Flow:
 *   FileKey  ← random 32 bytes
 *   file_ct  ← XChaCha20-Poly1305(FileKey, file_bytes)
 *   name_ct  ← XChaCha20-Poly1305(FileKey, name_bytes)
 *   wrap_ct  ← XChaCha20-Poly1305(DerivedKey, FileKey)
 *
 * @param {Uint8Array} derivedKey   32-byte key from Argon2id
 * @param {Uint8Array} fileBytes    raw file data
 * @param {string}     fileName     original file name
 * @returns {Object} all ciphertexts and nonces, base64url-encoded metadata
 */
export function encryptFile(derivedKey, fileBytes, fileName) {
  const fileKey = randomFileKey()

  // Encrypt file content
  const { ciphertext: fileCt, nonce: nonceFile } = encrypt(fileKey, fileBytes)

  // Encrypt original file name (so server never knows it)
  const nameBytes = new TextEncoder().encode(fileName)
  const { ciphertext: nameCt, nonce: nonceName } = encrypt(fileKey, nameBytes)

  // Wrap (encrypt) the FileKey with DerivedKey
  const { ciphertext: wrappedKey, nonce: nonceWrap } = encrypt(derivedKey, fileKey)

  return {
    fileCiphertext: fileCt,
    metadata: {
      nonce_file:     toB64(nonceFile),
      nonce_wrap:     toB64(nonceWrap),
      wrapped_key:    toB64(wrappedKey),
      nonce_name:     toB64(nonceName),
      encrypted_name: toB64(nameCt),
    },
  }
}

/**
 * Decrypt a downloaded file.
 *
 * @param {Uint8Array} derivedKey  32-byte key from Argon2id
 * @param {Uint8Array} fileCt      raw ciphertext bytes from server
 * @param {Object}     meta        { nonce_file, nonce_wrap, wrapped_key, nonce_name, encrypted_name }
 * @returns {{ fileBytes: Uint8Array, fileName: string }}
 * @throws if any decryption step fails (wrong phrase / corrupt data)
 */
export function decryptFile(derivedKey, fileCt, meta) {
  // Step 1: Unwrap FileKey
  const fileKey = decrypt(
    derivedKey,
    fromB64(meta.wrapped_key),
    fromB64(meta.nonce_wrap),
  )

  // Step 2: Decrypt file content
  const fileBytes = decrypt(fileKey, fileCt, fromB64(meta.nonce_file))

  // Step 3: Decrypt file name
  let fileName = 'decrypted_file'
  try {
    const nameBytes = decrypt(fileKey, fromB64(meta.encrypted_name), fromB64(meta.nonce_name))
    fileName = new TextDecoder().decode(nameBytes)
  } catch {
    // Non-fatal — fall back to generic name
  }

  return { fileBytes, fileName }
}
