import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Clock, Download, ChevronRight } from 'lucide-react'
import FileDropzone from '../components/FileDropzone.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { generatePhrase, phraseToString } from '../crypto/keygen.js'
import { deriveKey } from '../crypto/argon2.js'
import { encryptFile, randomSalt, toB64 } from '../crypto/cipher.js'
import { uploadInit, uploadComplete } from '../api/client.js'

const EXPIRY_OPTIONS = [
  { value: '10m', label: '10 minutes' },
  { value: '1h',  label: '1 hour' },
  { value: '24h', label: '24 hours' },
]
const DOWNLOAD_OPTIONS = [1, 2, 5]

const STEPS = [
  { label: 'Choose file', icon: '📁' },
  { label: 'Set limits', icon: '⏱' },
  { label: 'Encrypt & send', icon: '🔒' },
]

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.25 } },
}

// Stage labels shown under progress bar
const STAGE_LABELS = {
  keygen:    'Generating secret phrase…',
  derive:    'Deriving encryption key (Argon2id)…',
  encrypt:   'Encrypting file locally…',
  upload:    'Uploading ciphertext…',
}

export default function Upload() {
  const navigate = useNavigate()

  const [file, setFile]               = useState(null)
  const [step, setStep]               = useState(0)       // 0=pick, 1=options, 2=progress
  const [expires_in, setExpires]      = useState('1h')
  const [max_downloads, setMaxDl]     = useState(1)
  const [stage, setStage]             = useState(null)
  const [uploadPct, setUploadPct]     = useState(0)
  const [error, setError]             = useState(null)

  const handleFile = useCallback((f) => {
    setFile(f)
    if (f) setStep(1)
    else   setStep(0)
  }, [])

  async function encrypt() {
    if (!file) return
    setStep(2)
    setError(null)

    try {
      // ── 1. Generate secret phrase ────────────────────────────────
      setStage('keygen')
      const words  = generatePhrase()
      const phrase = phraseToString(words)

      // ── 2. Argon2id key derivation ───────────────────────────────
      setStage('derive')
      const salt       = randomSalt()           // 16 bytes
      const derivedKey = await deriveKey(phrase, salt)

      // ── 3. Encrypt file in browser ───────────────────────────────
      setStage('encrypt')
      const fileBytes = new Uint8Array(await file.arrayBuffer())
      const { fileCiphertext, metadata } = encryptFile(derivedKey, fileBytes, file.name)

      // ── 4. Init upload slot ──────────────────────────────────────
      const { id, upload_token } = await uploadInit({
        salt:       toB64(salt),
        ...metadata,
        size:       fileCiphertext.length,
        expires_in,
        max_downloads,
      })

      // ── 5. Upload ciphertext ─────────────────────────────────────
      setStage('upload')
      await uploadComplete(upload_token, fileCiphertext, setUploadPct)

      // ── Done: navigate to result page ────────────────────────────
      navigate('/result', { state: { id, words }, replace: true })
    } catch (err) {
      setError(err?.response?.data?.error ?? err.message ?? 'Something went wrong')
      setStep(1)
      setStage(null)
    }
  }

  return (
    <motion.div key="upload" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {/* ── Onboarding steps indicator ──────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${i === step ? 'opacity-100' : 'opacity-40'}`}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="opacity-30" />
            )}
          </div>
        ))}
      </div>

      {/* ── Main card ────────────────────────────────────────────────── */}
      <div className="card p-6 sm:p-8 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">

          {/* STEP 0 + 1: File picker + options */}
          {step < 2 && (
            <motion.div key="pick"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <h1 className="text-2xl font-bold mb-1">Send a file securely</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Encrypted in your browser before upload. The server never sees your keys or filename.
              </p>

              <FileDropzone file={file} onFile={handleFile} />

              <AnimatePresence>
                {step >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 grid sm:grid-cols-2 gap-4">
                      {/* Expiry */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2"
                          style={{ color: 'var(--muted)' }}>
                          <Clock size={13} /> Expires after
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {EXPIRY_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setExpires(opt.value)}
                              className="py-2 px-3 rounded-xl text-sm font-medium border transition-all duration-150"
                              style={{
                                borderColor: expires_in === opt.value ? 'var(--brand)' : 'var(--border)',
                                background:  expires_in === opt.value ? 'color-mix(in srgb, var(--brand) 15%, transparent)' : 'transparent',
                                color:       expires_in === opt.value ? 'var(--brand)' : 'var(--text)',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Max downloads */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2"
                          style={{ color: 'var(--muted)' }}>
                          <Download size={13} /> Max downloads
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {DOWNLOAD_OPTIONS.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setMaxDl(n)}
                              className="py-2 px-3 rounded-xl text-sm font-medium border transition-all duration-150"
                              style={{
                                borderColor: max_downloads === n ? 'var(--brand)' : 'var(--border)',
                                background:  max_downloads === n ? 'color-mix(in srgb, var(--brand) 15%, transparent)' : 'transparent',
                                color:       max_downloads === n ? 'var(--brand)' : 'var(--text)',
                              }}
                            >
                              {n}×
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {error && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mt-4 text-sm font-medium rounded-lg px-4 py-2.5"
                        style={{ background: 'color-mix(in srgb, var(--error) 12%, transparent)', color: 'var(--error)' }}>
                        {error}
                      </motion.p>
                    )}

                    <motion.button
                      type="button"
                      onClick={encrypt}
                      className="btn-brand w-full mt-5"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Lock size={16} />
                      Encrypt &amp; generate link
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {step === 0 && (
                <div className="mt-8 grid sm:grid-cols-3 gap-4">
                  {[
                    { icon: '🔑', title: 'Client-side keys', desc: 'Your file is encrypted before it leaves your device.' },
                    { icon: '🗑', title: 'Auto-delete', desc: 'Files vanish after time limit or max downloads.' },
                    { icon: '🔗', title: 'Link + phrase', desc: 'Link and secret phrase are always separate.' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="rounded-xl p-4 text-sm" style={{ background: 'var(--border)' }}>
                      <div className="text-2xl mb-2">{icon}</div>
                      <p className="font-semibold mb-1">{title}</p>
                      <p style={{ color: 'var(--muted)' }}>{desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: Encrypting / uploading */}
          {step === 2 && (
            <motion.div key="progress"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8 gap-6"
            >
              {/* Animated lock icon */}
              <motion.div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--brand) 15%, transparent)' }}
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <Lock size={36} style={{ color: 'var(--brand)' }} />
              </motion.div>

              <div className="text-center">
                <h2 className="text-xl font-bold mb-1">
                  {stage === 'upload' ? 'Uploading…' : 'Encrypting…'}
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {STAGE_LABELS[stage] ?? 'Processing…'}
                </p>
              </div>

              <div className="w-full max-w-sm">
                {stage === 'upload'
                  ? <ProgressBar pct={uploadPct} label="Upload" />
                  : (
                    <div className="progress-track">
                      <motion.div
                        className="progress-fill h-2"
                        animate={{ width: ['0%', '70%', '40%', '90%'] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                      />
                    </div>
                  )
                }
              </div>

              <p className="text-xs text-center max-w-xs" style={{ color: 'var(--muted)' }}>
                Keys never leave your browser. The server only receives encrypted data.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
