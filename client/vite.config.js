import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: (() => {
      // Try to use the same certs as the main server
      const keyPath = path.resolve(__dirname, '..', 'certs', 'server.key')
      const certPath = path.resolve(__dirname, '..', 'certs', 'server.cert')
      
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        }
      }
      
      // If certs don't exist, Vite will generate its own (for dev only)
      console.warn('Certificate files not found. Vite will use self-signed cert or generate one.')
      return true
    })(),
    port: 5173
  }
})
