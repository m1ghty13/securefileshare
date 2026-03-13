import { motion } from 'framer-motion'

export default function ProgressBar({ pct, label, color }) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="progress-track">
        <motion.div
          className="progress-fill"
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={color ? { background: color } : undefined}
        />
      </div>
    </div>
  )
}
