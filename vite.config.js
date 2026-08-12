import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1000, // رفع الحد من 500 كيلوبايت إلى 1000 (الافتراضي 500)
  },
})
