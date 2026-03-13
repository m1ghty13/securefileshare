# XivoraShare

Zero-knowledge one-time encrypted file transfer for the web.

**Made by Xivora**

**The server never sees your keys, your file name, or your secret phrase.**

---

## How it works

1. You pick a file → your browser generates **12 secret words**
2. The file is encrypted locally with **XChaCha20-Poly1305**
3. The browser derives a key from the phrase using **Argon2id** (t=3, m=64 MB, p=4)
4. Only the ciphertext + wrapped key reach the server
5. Recipient opens the link, enters the 12 words → file decrypts in their browser
6. File auto-deletes after the time limit or max download count

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS + Framer Motion |
| File cipher | XChaCha20-Poly1305 (`@noble/ciphers`) |
| KDF | Argon2id (`hash-wasm` WASM) |
| Backend | Node.js + Fastify 4 |
| Database | SQLite (`better-sqlite3`) |
| Storage | Local filesystem |

**Why Vite + Fastify instead of Next.js?** Clean separation ensures client-side crypto can be audited independently of server code. The server is a pure "store encrypted bytes" service with no awareness of keys.

---

## Quick start (Docker)

```bash
git clone <repo>
cd secureshare
docker compose up --build
```

Frontend → http://localhost:5173  
Backend  → http://localhost:3001

---

## Local development

**Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

---

## Tests

```bash
# Backend (API + cleanup worker — 11 tests)
cd backend && npm test

# Frontend (crypto unit tests — 20 tests)
cd frontend && npm test
```

---

## API Contract

### `POST /api/upload/init`
Creates an upload slot. Returns `{ id, upload_token }`.

**Body:**
```json
{
  "salt":           "base64url",
  "nonce_file":     "base64url",
  "nonce_wrap":     "base64url",
  "wrapped_key":    "base64url",
  "nonce_name":     "base64url",
  "encrypted_name": "base64url",
  "size":           12345,
  "expires_in":     "1h",
  "max_downloads":  1
}
```

`expires_in`: `"10m"` | `"1h"` | `"24h"`  
`max_downloads`: `1` | `2` | `5`

---

### `POST /api/upload/complete/:upload_token`
Uploads the raw ciphertext as `multipart/form-data`. Returns `{ id }`.

---

### `GET /api/file/:id/meta`
Returns all public parameters needed for client decryption. **Never returns keys.**

```json
{
  "id": "...",
  "salt": "base64url",
  "nonce_file": "base64url",
  "nonce_wrap": "base64url",
  "wrapped_key": "base64url",
  "nonce_name": "base64url",
  "encrypted_name": "base64url",
  "file_size": 12345,
  "expires_at": 1735000000,
  "max_downloads": 1,
  "downloads_remaining": 1,
  "created_at": 1734996400
}
```

---

### `GET /api/file/:id/download`
Streams raw ciphertext (`application/octet-stream`). No keys.

---

### `POST /api/file/:id/confirm_download`
Called after successful client-side decryption. Decrements counter; deletes file at 0.

---

### `POST /api/file/:id/report_failed_download`
Called when client decryption fails. **Counter is not decremented** — the download attempt failed.

---

## Security design

- **Client-only keys** — Argon2id, XChaCha20-Poly1305 run entirely in the browser
- **Zero server knowledge** — server holds only ciphertext + wrapped key  
- **Separate link and phrase** — URL and phrase are independent; intercepting one is useless
- **Rate limiting** — per hashed-IP in memory; raw IPs never logged  
- **No analytics, no cookies, no tracking**
- **Auto-delete** — cleanup worker runs every 60 s

---

## Entropy

12 words × 11 bits = **132 bits of entropy**  
This exceeds the 128-bit security level of the underlying symmetric cipher.
