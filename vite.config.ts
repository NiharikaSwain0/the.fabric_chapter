import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll('\\', '/')
          if (path.includes('/node_modules/@firebase/') || path.includes('/node_modules/firebase/')) {
            return 'firebase'
          }
          if (path.includes('/node_modules/react/') ||
            path.includes('/node_modules/react-dom/') ||
            path.includes('/node_modules/react-router/')) {
            return 'framework'
          }
        },
      },
    },
  },
})
