import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Unlock, AlertTriangle, CheckCircle, XCircle, Key } from 'lucide-react'
import WordInput from '../components/WordInput.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { validatePhrase, phraseToString } from '../crypto/keygen.js'
import { deriveKey } from '../crypto/argon2.js'
import { decryptFile, fromB64 } from '../crypto/cipher.js'
import { getFileMeta, downloadFile, confirmDownload, reportFailedDownload } from '../api/client.js'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -10 },
}

const STAGES = {
  idle:     null,
  fetching: 'Fetching encrypted file…',
  deriving: 'Deriving key with Argon2id… (may take a few seconds)',
  decrypt:  'Decrypting locally…',
  saving:   'Saving file…',
}

function formatExpiry(expiresAt) {
  const secs = expiresAt - Math.floor(Date.now() / 1000)
  if (secs <= 0) return 'expired'
  if (secs < 3600) return `${Math.ceil(secs / 60)} min`
  if (secs < 86400) return `${Math.ceil(secs / 3600)} hr`
  return `${Math.ceil(secs / 86400)} d`
}

export default function Download() {
  const { id } = useParams()

  const [meta, setMeta]         = useState(null)
  const [metaError, setMetaErr] = useState(null)

  const [words, setWords]       = useState(Array(12).fill(''))
  const [stage, setStage]       = useState('idle')
  const [downloadPct, setDlPct] = useState(0)
  const [error, setError]       = useState(null)
  const [done, setDone]         = useState(false)

  // Fetch metadata on mount
  useEffect(() => {
    getFileMeta(id)
      .then(setMeta)
      .catch((err) => {
        if (err?.response?.status === 404) setMetaErr('This file does not exist or has already expired.')
        else setMetaErr('Could not load file. Try again later.')
      })
  }, [id])

  const allWordsEntered = words.every((w) => w.trim().length > 0)

  async function handleDecrypt() {
    if (!meta) return
    setError(null)

    const normalized = words.map((w) => w.trim().toLowerCase())
    if (!validatePhrase(normalized)) {
      setError('One or more words are not in the word list. Check spelling.')
      return
    }

    setStage('fetching')
    setDlPct(0)

    let cipherBytes
    try {
      cipherBytes = await downloadFile(id, setDlPct)
    } catch {
      setStage('idle')
      setError('Download failed. The file may have been deleted.')
      return
    }

    setStage('deriving')
    let derivedKey
    try {
      const phrase = phraseToString(normalized)
      const salt   = fromB64(meta.salt)
      derivedKey   = await deriveKey(phrase, salt)
    } catch {
      setStage('idle')
      await reportFailedDownload(id)
      setError('Key derivation failed. Try again.')
      return
    }

    setStage('decrypt')
    let fileBytes, fileName
    try {
      const result = decryptFile(derivedKey, cipherBytes, meta)
      fileBytes  = result.fileBytes
      fileName   = result.fileName
    } catch {
      setStage('idle')
      await reportFailedDownload(id)
      setError('Wrong secret phrase or the file is corrupted. Decryption failed.')
      return
    }

    setStage('saving')
    // Trigger browser save dialog
    const blob = new Blob([fileBytes])
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Notify server — decrement counter
    await confirmDownload(id).catch(() => {})

    setStage('idle')
    setDone(true)
  }

  const busy = stage !== 'idle'

  // ── Render states ────────────────────────────────────────────────────────

  if (metaError) {
    return (
      <motion.div key="dl-err" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <div className="card max-w-md mx-auto p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--error) 12%, transparent)' }}>
            <XCircle size={32} style={{ color: 'var(--error)' }} />
          </div>
          <h1 className="text-xl font-bold">File not found</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{metaError}</p>
        </div>
      </motion.div>
    )
  }

  if (!meta) {
    return (
      <div className="max-w-md mx-auto card p-8">
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="shimmer h-4 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <motion.div key="dl-done" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <div className="card max-w-md mx-auto p-8 flex flex-col items-center text-center gap-4">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)' }}>
            <CheckCircle size={32} style={{ color: 'var(--success)' }} />
          </motion.div>
          <h1 className="text-xl font-bold">File decrypted!</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Your browser saved the file. The download counter has been updated.
          </p>
          {meta.downloads_remaining > 1 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {meta.downloads_remaining - 1} download(s) remaining on this link.
            </p>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div key="download" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="max-w-lg mx-auto">

        {/* File info badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ background: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Lock size={14} style={{ color: 'var(--brand)' }} />
            <span className="font-mono text-xs">{id}</span>
          </div>
          <div className="flex items-center gap-3" style={{ color: 'var(--muted)' }}>
            <span>⏱ {formatExpiry(meta.expires_at)}</span>
            <span>↓ {meta.downloads_remaining}×</span>
          </div>
        </motion.div>

        <div className="card p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {/* ── Idle: enter phrase ─────────────────────────────── */}
            {!busy && (
              <motion.div key="phrase-input"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--brand) 15%, transparent)' }}>
                    <Key size={20} style={{ color: 'var(--brand)' }} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">Enter secret phrase</h1>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      12 words separated by spaces
                    </p>
                  </div>
                </div>

                <WordInput words={words} onChange={setWords} />

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium"
                      style={{ background: 'color-mix(in srgb, var(--error) 12%, transparent)', color: 'var(--error)' }}
                    >
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  onClick={handleDecrypt}
                  disabled={!allWordsEntered}
                  className="btn-brand w-full mt-5"
                  whileHover={{ scale: allWordsEntered ? 1.01 : 1 }}
                  whileTap={{ scale: allWordsEntered ? 0.98 : 1 }}
                >
                  <Unlock size={16} />
                  Decrypt &amp; download
                </motion.button>

                <p className="mt-3 text-xs text-center" style={{ color: 'var(--muted)' }}>
                  Decryption happens entirely in your browser.
                </p>
              </motion.div>
            )}

            {/* ── Busy: progress ─────────────────────────────────── */}
            {busy && (
              <motion.div key="progress"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-6 gap-5"
              >
                <motion.div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--brand) 15%, transparent)' }}
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Lock size={28} style={{ color: 'var(--brand)' }} />
                </motion.div>

                <div className="text-center">
                  <h2 className="text-lg font-bold mb-1">Working…</h2>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {STAGES[stage] ?? 'Processing…'}
                  </p>
                </div>

                {stage === 'fetching'
                  ? <div className="w-full max-w-xs"><ProgressBar pct={downloadPct} label="Downloading" /></div>
                  : (
                    <div className="w-full max-w-xs progress-track">
                      <motion.div className="progress-fill h-2"
                        animate={{ width: ['0%', '75%', '40%', '95%'] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                      />
                    </div>
                  )
                }
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
