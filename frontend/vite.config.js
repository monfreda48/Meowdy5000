import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

let commitSha = '664d25b';
try {
  commitSha = execSync('git rev-parse --short HEAD').toString().trim().slice(0, 7);
} catch (e) {}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'import.meta.env.VITE_APP_COMMIT_SHA': JSON.stringify(commitSha)
  },
  server: {
    watch: {
      ignored: ['**/android/**', '**/*.apk']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
})