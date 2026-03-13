import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, File, X } from 'lucide-react'

const MAX_SIZE = 200 * 1024 * 1024 // 200 MB

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FileDropzone({ file, onFile }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const handle = useCallback((f) => {
    setError(null)
    if (!f) return
    if (f.size > MAX_SIZE) {
      setError(`File too large — max 200 MB (your file: ${formatSize(f.size)})`)
      return
    }
    onFile(f)
  }, [onFile])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handle(e.dataTransfer.files[0])
  }, [handle])

  const onInput = useCallback((e) => handle(e.target.files[0]), [handle])

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`dropzone ${dragging ? 'active' : ''}`}
        style={{ cursor: 'pointer' }}
      >
        <input
          type="file"
          className="sr-only"
          onChange={onInput}
          tabIndex={-1}
        />

        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--brand) 15%, transparent)' }}>
                <File size={28} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <p className="font-semibold text-base truncate max-w-xs">{file.name}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onFile(null) }}
                className="flex items-center gap-1 text-sm mt-1 hover:opacity-80 transition-opacity"
                style={{ color: 'var(--error)' }}
              >
                <X size={14} /> Remove
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{ y: dragging ? -6 : 0 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
              >
                <UploadCloud size={32} style={{ color: 'var(--brand)' }} />
              </motion.div>
              <div>
                <p className="font-semibold text-base">
                  {dragging ? 'Drop it here' : 'Drop a file or click to browse'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                  Any file type &middot; max 200 MB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </label>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 text-sm font-medium"
            style={{ color: 'var(--error)' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
