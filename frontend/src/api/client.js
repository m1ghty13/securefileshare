import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://xivorabackend-xivora.amvera.io'

const api = axios.create({
  baseURL: BASE,
  timeout: 0, // uploads can be large — no timeout
})

// Never add Authorization headers or log request details

/**
 * Step 1: Initialise upload slot.
 * Returns { id, upload_token }.
 */
export async function uploadInit({ salt, nonce_file, nonce_wrap, wrapped_key, nonce_name, encrypted_name, size, expires_in, max_downloads }) {
  const { data } = await api.post('/api/upload/init', {
    salt, nonce_file, nonce_wrap, wrapped_key,
    nonce_name, encrypted_name, size, expires_in, max_downloads,
  })
  return data
}

/**
 * Step 2: Upload encrypted ciphertext blob.
 * @param {string}   uploadToken
 * @param {Uint8Array} ciphertext
 * @param {function} onProgress  (pct: number) => void
 * Returns { id }.
 */
export async function uploadComplete(uploadToken, ciphertext, onProgress) {
  const form = new FormData()
  form.append('file', new Blob([ciphertext], { type: 'application/octet-stream' }), 'encrypted')

  const { data } = await api.post(`/api/upload/complete/${uploadToken}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

/**
 * Fetch file metadata (salt, nonces, wrapped_key, etc.) for decryption.
 */
export async function getFileMeta(id) {
  const { data } = await api.get(`/api/file/${id}/meta`)
  return data
}

/**
 * Download raw ciphertext as ArrayBuffer.
 * @param {string}   id
 * @param {function} onProgress  (pct: number) => void
 */
export async function downloadFile(id, onProgress) {
  const { data } = await api.get(`/api/file/${id}/download`, {
    responseType: 'arraybuffer',
    onDownloadProgress: (e) => {
      if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return new Uint8Array(data)
}

/**
 * Notify server that decryption succeeded; decrements download counter.
 */
export async function confirmDownload(id) {
  const { data } = await api.post(`/api/file/${id}/confirm_download`)
  return data
}

/**
 * Notify server that decryption failed; counter is NOT decremented.
 */
export async function reportFailedDownload(id) {
  await api.post(`/api/file/${id}/report_failed_download`).catch(() => {})
}
