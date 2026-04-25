import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/clientes-admin/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2pdf.js') || id.includes('node_modules/html2canvas')) return 'pdf'
          if (id.includes('node_modules/@dnd-kit')) return 'dnd'
        }
      }
    }
  },
})
