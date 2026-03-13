import { motion } from 'framer-motion'
import { Shield, Lock, Key, Trash2, Server, Eye, GitBranch } from 'lucide-react'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -10 },
}

const section = (props) => props

const SECTIONS = [
  {
    icon: <Lock size={20} />,
    title: 'What happens when you upload',
    color: '#6366f1',
    steps: [
      { label: '12-word phrase generated', desc: 'Your browser calls crypto.getRandomValues and picks 12 words from a 2048-word list (132 bits of entropy). These words are shown to you and never sent to the server.' },
      { label: 'Argon2id key derivation', desc: 'A 32-byte key is derived from the 12 words using Argon2id (t=3, m=64 MB, p=4). A unique 16-byte random salt is generated per upload; the salt is stored on the server (it is not secret).' },
      { label: 'File encryption', desc: 'A random 32-byte FileKey is generated. The file is encrypted with XChaCha20-Poly1305 using FileKey. The AEAD tag authenticates every byte.' },
      { label: 'Name encryption', desc: 'The original file name is also encrypted with FileKey so the server never knows it.' },
      { label: 'Key wrapping', desc: 'FileKey is encrypted ("wrapped") with the Argon2id-derived key. Only the wrapped key is stored on the server.' },
      { label: 'Upload', desc: 'The server receives: ciphertext, wrapped key, salt, nonces, and settings. Nothing the server holds can decrypt the file without the 12 words.' },
    ],
  },
  {
    icon: <Key size={20} />,
    title: 'What happens when you download',
    color: '#10b981',
    steps: [
      { label: 'Fetch metadata', desc: 'The server sends salt, nonces, and wrapped key — all public parameters needed for decryption.' },
      { label: 'Re-derive key', desc: 'Your 12 words + the stored salt → Argon2id → same 32-byte key. This is computationally expensive by design (attacker must run Argon2id for every guess).' },
      { label: 'Unwrap FileKey', desc: 'The derived key decrypts the wrapped FileKey with XChaCha20-Poly1305. If the Poly1305 tag fails, the phrase was wrong — "Wrong secret phrase" error is shown.' },
      { label: 'Decrypt file', desc: 'FileKey decrypts the ciphertext. The browser saves the file directly to your disk.' },
      { label: 'Confirm', desc: 'After a successful save your browser tells the server to decrement the download counter. If decryption failed, the server is notified separately and the counter is not reduced.' },
    ],
  },
  {
    icon: <Server size={20} />,
    title: 'What the server knows',
    color: '#f59e0b',
    items: [
      '✅ Ciphertext (encrypted bytes — meaningless without key)',
      '✅ Salt (required for Argon2id — not a secret)',
      '✅ Nonces (public parameters for each AEAD)',
      '✅ Wrapped key (encrypted FileKey — useless without 12 words)',
      '✅ File size, expiry time, download counter',
      '❌ The 12 words (never sent)',
      '❌ The raw FileKey (never sent)',
      '❌ The original file name (encrypted with FileKey)',
      '❌ Your IP address (not logged or stored)',
    ],
  },
  {
    icon: <Eye size={20} />,
    title: 'Logging & privacy',
    color: '#8b5cf6',
    body: 'Production mode has zero access logs. The rate limiter uses a SHA-256 hash of your IP in memory only — it is never written to disk. No analytics, no tracking, no cookies.',
  },
  {
    icon: <Trash2 size={20} />,
    title: 'Automatic deletion',
    color: '#ef4444',
    body: 'Files are deleted as soon as the expiry time passes or the download counter reaches zero. A background worker runs every 60 seconds to catch anything missed. Once deleted, the ciphertext and all metadata are gone permanently.',
  },
  {
    icon: <GitBranch size={20} />,
    title: 'Why XChaCha20-Poly1305?',
    color: '#06b6d4',
    body: 'XChaCha20-Poly1305 is an AEAD (Authenticated Encryption with Associated Data) cipher. It provides both confidentiality and integrity. The 192-bit nonce (vs 96-bit for AES-GCM) eliminates nonce-reuse risks for randomly generated nonces. The implementation uses @noble/ciphers — a formally audited, pure-JS library with no native dependencies.',
  },
]

function Section({ section: s, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="card p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)`, color: s.color }}>
          {s.icon}
        </div>
        <h2 className="text-lg font-bold">{s.title}</h2>
      </div>

      {s.steps && (
        <ol className="space-y-3">
          {s.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: `color-mix(in srgb, ${s.color} 20%, transparent)`, color: s.color }}>
                {i + 1}
              </div>
              <div>
                <p className="font-semibold text-sm">{step.label}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {s.items && (
        <ul className="space-y-1.5">
          {s.items.map((item, i) => (
            <li key={i} className="text-sm font-mono" style={{ color: item.startsWith('❌') ? 'var(--muted)' : 'var(--text)' }}>
              {item}
            </li>
          ))}
        </ul>
      )}

      {s.body && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{s.body}</p>
      )}
    </motion.div>
  )
}

export default function Privacy() {
  return (
    <motion.div key="privacy" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'color-mix(in srgb, var(--brand) 15%, transparent)' }}>
            <Shield size={28} style={{ color: 'var(--brand)' }} />
          </div>
          <h1 className="text-3xl font-bold mb-2">How XivoraShare works</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Plain-language explanation of the cryptographic design
          </p>
        </div>

        {/* Quick summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 mb-6 text-sm leading-relaxed"
          style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)' }}
        >
          <strong>One sentence:</strong> Your file is encrypted in your browser with a random key, that key is locked with a password derived from your 12-word phrase using Argon2id, and only the locked key + ciphertext ever reach the server — making server-side decryption computationally impossible without the phrase.
        </motion.div>

        <div className="space-y-4">
          {SECTIONS.map((s, i) => (
            <Section key={i} section={s} index={i} />
          ))}
        </div>

        {/* Crypto primitives table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="card p-6 mt-4"
        >
          <h2 className="text-lg font-bold mb-4">Crypto primitives at a glance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--muted)' }} className="text-left text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-4">Purpose</th>
                  <th className="pb-2 pr-4">Algorithm</th>
                  <th className="pb-2">Library</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {[
                  ['Entropy source', 'crypto.getRandomValues', 'Browser Web Crypto API'],
                  ['KDF', 'Argon2id (t=3, m=64 MB, p=4)', 'hash-wasm (WASM)'],
                  ['File encryption', 'XChaCha20-Poly1305', '@noble/ciphers (audited)'],
                  ['Key wrap', 'XChaCha20-Poly1305', '@noble/ciphers'],
                  ['Name encryption', 'XChaCha20-Poly1305', '@noble/ciphers'],
                  ['Rate limit key', 'SHA-256(IP)', 'Node.js crypto'],
                ].map(([p, a, l]) => (
                  <tr key={p}>
                    <td className="py-2 pr-4 font-medium">{p}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{a}</td>
                    <td className="py-2 text-xs" style={{ color: 'var(--muted)' }}>{l}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
