import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Copy } from 'lucide-react'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0 },
}

export default function WordDisplay({ words }) {
  const [copied, setCopied] = useState(false)

  async function copyAll() {
    await navigator.clipboard.writeText(words.join(' '))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 sm:grid-cols-4 gap-2"
      >
        {words.map((word, i) => (
          <motion.div key={i} variants={item}>
            <div className="word-chip flex gap-2">
              <span style={{ color: 'var(--muted)', userSelect: 'none', minWidth: '1.4rem', fontSize: '0.7rem' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{word}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <button
        onClick={copyAll}
        className="btn-ghost mt-4 text-sm w-full"
      >
        {copied ? <CheckCircle size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
        {copied ? 'Copied!' : 'Copy all 12 words'}
      </button>
    </div>
  )
}
