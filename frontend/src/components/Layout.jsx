import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion'

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="p-2 rounded-xl transition-colors"
      style={{ background: 'var(--border)', color: 'var(--text)' }}
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </motion.button>
  )
}

export default function Layout({ children }) {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
            <Shield size={20} style={{ color: 'var(--brand)' }} />
            <span>XivoraShare</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/privacy"
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: location.pathname === '/privacy' ? 'var(--brand)' : 'var(--muted)' }}
            >
              How it works
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <p>
          Zero-knowledge file transfer &middot;{' '}
          <Link to="/privacy" className="hover:underline" style={{ color: 'var(--brand)' }}>
            Privacy & crypto details
          </Link>
        </p>
        <p className="mt-1" style={{ fontSize: '0.7rem', opacity: 0.5 }}>made by Xivora</p>
      </footer>
    </div>
  )
}
