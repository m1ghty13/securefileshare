import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      // Vite strips "node:" prefix causing built-in resolution to fail.
      // This plugin marks all node:* imports as external so Vite never
      // tries to bundle them — Node's native loader handles them directly.
      name: 'externalize-node-builtins',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'node:sqlite' || id === 'sqlite') {
          return { id: 'node:sqlite', external: true }
        }
        if (id.startsWith('node:')) {
          return { id, external: true }
        }
      },
    },
  ],
  test: {
    environment: 'node',
    globals: false,
    sequence: { concurrent: false },
  },
})
