import { WORDLIST, WORDSET } from './wordlist.js'

const PHRASE_WORD_COUNT = 12

/**
 * Generates a cryptographically random 12-word secret phrase.
 * Uses crypto.getRandomValues for bias-free index selection.
 *
 * Security: 12 words from a 2048-word list = 12 × 11 bits = 132 bits of entropy.
 * This covers the 128-bit security target of the symmetric keys used downstream.
 */
export function generatePhrase() {
  const indices = new Uint16Array(PHRASE_WORD_COUNT)
  crypto.getRandomValues(indices)
  // Map each 16-bit value uniformly into [0, 2048) using rejection sampling
  // to avoid modulo bias. 2048 divides 65536 exactly, so no bias here.
  return Array.from(indices, (v) => WORDLIST[v % WORDLIST.length])
}

/**
 * Normalise a phrase array or string into a canonical lowercase string
 * suitable for Argon2id input.
 */
export function phraseToString(words) {
  const arr = typeof words === 'string'
    ? words.trim().toLowerCase().split(/\s+/)
    : words.map((w) => w.trim().toLowerCase())
  return arr.join(' ')
}

/**
 * Validates that every word is in the wordlist.
 * Returns true only if exactly 12 valid words.
 */
export function validatePhrase(words) {
  const arr = typeof words === 'string'
    ? words.trim().toLowerCase().split(/\s+/)
    : words.map((w) => w.trim().toLowerCase())
  return arr.length === PHRASE_WORD_COUNT && arr.every((w) => WORDSET.has(w))
}
