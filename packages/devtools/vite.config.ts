import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: { index: 'src/index.ts', client: 'src/client.ts' },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    target: 'es2022',
    emptyOutDir: true,
    rollupOptions: {
      external: ['devframe/client'],
    },
  },
})
