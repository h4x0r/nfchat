import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'child_process'

// Use Vercel env var if available, otherwise git command for local dev
const commitHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'unknown' } })()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    // Increase warning limit for lazy-loaded chunks that include DuckDB WASM
    // Main chunk is under 500KB, lazy chunks are intentionally larger
    chunkSizeWarningLimit: 300,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Allow serving files from datasets folder during development
      allow: ['..'],
    },
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
})
