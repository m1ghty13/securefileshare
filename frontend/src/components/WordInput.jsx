import { useRef, useCallback, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { WORDSET } from '../crypto/wordlist.js'

const COUNT = 12

/** Strip leading numbers from pasted numbered lists like "1 radio\n 2 power" */
function extractWords(text) {
  // Split into lines, strip each line's leading number + whitespace, collect words
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const words = []
  for (const line of lines) {
    // Remove leading number (e.g. "1 radio" → "radio", " 10 napkin" → "napkin")
    const cleaned = line.replace(/^\d+\s+/, '')
    // Split remaining by whitespace in case a line has multiple words
    cleaned.split(/\s+/).filter(Boolean).forEach(w => words.push(w.toLowerCase()))
  }
  return words
}

export default function WordInput({ words, onChange }) {
  const refs = useRef([])

  const set = (i, val) => {
    const next = [...words]
    next[i] = val.toLowerCase().trim()
    onChange(next)
  }

  const onKeyDown = (i, e) => {
    if ((e.key === ' ' || e.key === 'Tab' || e.key === 'Enter') && i < COUNT - 1) {
      e.preventDefault()
      refs.current[i + 1]?.focus()
    }
    if (e.key === 'Backspace' && words[i] === '' && i > 0) {
      e.preventDefault()
      refs.current[i - 1]?.focus()
    }
  }

  const onPaste = (i, e) => {
    const text = e.clipboardData.getData('text')
    const parts = extractWords(text)
    if (parts.length > 1) {
      e.preventDefault()
      const next = [...words]
      parts.slice(0, COUNT - i).forEach((w, j) => { next[i + j] = w })
      onChange(next)
      const focusIdx = Math.min(i + parts.length, COUNT - 1)
      setTimeout(() => refs.current[focusIdx]?.focus(), 50)
    }
  }

  function wordState(w) {
    if (!w) return 'empty'
    return WORDSET.has(w) ? 'valid' : 'invalid'
  }

  const borderColor = (w) => {
    const s = wordState(w)
    if (s === 'valid')   return 'var(--success)'
    if (s === 'invalid') return 'var(--error)'
    return 'var(--border)'
  }

  async function pasteAll() {
    try {
      const text = await navigator.clipboard.readText()
      const parts = extractWords(text).slice(0, COUNT)
      const next = Array(COUNT).fill('')
      parts.forEach((w, i) => { next[i] = w })
      onChange(next)
      refs.current[Math.min(parts.length, COUNT - 1)]?.focus()
    } catch {
      // clipboard access denied — user can paste manually
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {Array.from({ length: COUNT }, (_, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span
              className="text-[10px] font-mono select-none pl-1"
              style={{ color: 'var(--muted)', opacity: 0.6 }}
            >
              {i + 1}
            </span>
            <input
              ref={(el) => { refs.current[i] = el }}
              type="text"
              value={words[i] || ''}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="input-field text-xs"
              style={{ borderColor: borderColor(words[i]) }}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => onPaste(i, e)}
            />
          </div>
        ))}
      </div>

      <button type="button" onClick={pasteAll} className="btn-ghost mt-3 text-sm w-full">
        <ClipboardPaste size={15} />
        Paste all 12 words
      </button>
    </div>
  )
}
