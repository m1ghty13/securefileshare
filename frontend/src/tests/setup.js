import '@testing-library/jest-dom'

// Polyfill crypto.getRandomValues for jsdom
import { webcrypto } from 'node:crypto'
Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
