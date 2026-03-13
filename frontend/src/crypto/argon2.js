import { argon2id } from 'hash-wasm'

/**
 * Argon2id parameters — chosen for browser safety:
 *
 *   t (iterations)  = 3   — OWASP minimum for Argon2id
 *   m (memory)      = 64 MB (65536 KiB) — high enough to resist ASICs/GPUs,
 *                            acceptable for modern browsers (~1-3 s on mid-range hardware)
 *   p (parallelism) = 4   — utilises multi-core without excessive RAM pressure
 *   len             = 32  — 256-bit derived key for XChaCha20-Poly1305
 *
 * An attacker running on GPU (10× faster per trial) would still need:
 *   ~5×10²² attempts to brute-force a 12-word (132-bit) phrase.
 */
export const ARGON2_PARAMS = {
  iterations:  3,
  memorySize:  65536, // KiB
  parallelism: 4,
  hashLength:  32,
}

/**
 * Derives a 32-byte key from the secret phrase and a random salt.
 * @param {string}     phrase   Space-separated 12-word string
 * @param {Uint8Array} salt     16-byte random salt (stored server-side)
 * @returns {Promise<Uint8Array>} 32-byte derived key
 */
export async function deriveKey(phrase, salt) {
  const result = await argon2id({
    password:    phrase,
    salt,
    ...ARGON2_PARAMS,
    outputType: 'binary',
  })
  return result
}
