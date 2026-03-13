import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Download, CheckCircle, Shield, AlertTriangle, ExternalLink } from 'lucide-react'
import WordDisplay from '../components/WordDisplay.jsx'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -10 },
}

export default function Result() {
  const { state } = useLocation()
  const navigate  = useNavigate()

  const [linkCopied, setLinkCopied]       = useState(false)
  const [savedPhrase, setSavedPhrase]     = useState(false)
  const [phraseSaved, setPhraseSaved]     = useState(false)

  // Guard: if navigated here without data, redirect home
  useEffect(() => {
    if (!state?.id || !state?.words) navigate('/', { replace: true })
  }, [state, navigate])

  if (!state?.id) return null

  const { id, words } = state
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const shareUrl = `${window.location.origin}${base}/f/${id}`

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  function downloadPhraseFile() {
    const content = [
      'Secret phrase (12 words):',
      words.join(' '),
      '',
      ...words.map((w, i) => `${String(i + 1).padStart(2)} ${w}`),
      '',
      '============================',
      'Generated: ' + new Date().toISOString(),
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `xivorashare-phrase-${id.slice(0, 8)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setSavedPhrase(true)
  }

  return (
    <motion.div key="result" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="max-w-2xl mx-auto">

        {/* Success header */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          className="flex flex-col items-center mb-8 text-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)' }}>
            <CheckCircle size={32} style={{ color: 'var(--success)' }} />
          </div>
          <h1 className="text-2xl font-bold">File encrypted &amp; ready</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Share the link separately from the secret phrase.
          </p>
        </motion.div>

        {/* Share link card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card p-5 mb-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            Share link
          </p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl px-4 py-2.5 font-mono text-sm overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ background: 'var(--border)' }}>
              {shareUrl}
            </div>
            <motion.button
              onClick={copyLink}
              className="btn-ghost px-4"
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              aria-label="Copy link"
            >
              {linkCopied ? <CheckCircle size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
            </motion.button>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-4">
              <ExternalLink size={16} />
            </a>
          </div>
        </motion.div>

        {/* Secret phrase card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card p-5 mb-4"
        >
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4"
            style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)' }}>
            <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>
              Save these 12 words now. They are <strong>not stored anywhere</strong> and cannot be recovered.
            </p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            Secret phrase — send this separately
          </p>

          <WordDisplay words={words} />

          {/* Download phrase file */}
          <motion.button
            onClick={downloadPhraseFile}
            className="btn-ghost w-full mt-3 text-sm"
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          >
            <Download size={15} />
            {savedPhrase ? 'Phrase file downloaded ✓' : 'Download phrase as .txt'}
          </motion.button>
        </motion.div>

        {/* Confirmation gate */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card p-5"
        >
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={phraseSaved}
              onChange={(e) => setPhraseSaved(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-indigo-500"
            />
            <span className="text-sm font-medium">
              I have saved the 12-word secret phrase in a safe place. I understand it cannot be recovered.
            </span>
          </label>

          <AnimatePresence>
            {phraseSaved && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Link to="/" className="btn-brand flex-1 justify-center text-sm">
                    <Shield size={15} />
                    Send another file
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!phraseSaved && (
            <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
              You must confirm you have saved the phrase before leaving this page.
            </p>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
