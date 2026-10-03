import { defineConfig } from 'vite'
import { pmndrsDevtools } from '@pmndrs/devtools-vite'

const remote = process.env.PMNDRS_DEVTOOLS_REMOTE === '1'

export default defineConfig({
  server: { host: remote },
  plugins: [
    pmndrsDevtools({
      host: remote ? '0.0.0.0' : 'localhost',
      // Remote LAN mode keeps Devframe's auth gate on. Origin checks are
      // intentionally disabled in the DevTools bridge for LAN development.
      auth: remote,
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: 'index.html',
        app: 'app.html',
      },
    },
  },
})
