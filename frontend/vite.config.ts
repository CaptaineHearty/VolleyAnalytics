/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En dev, Vite (port 5173) renvoie ces chemins vers Django (port 8000).
// Le navigateur ne voit qu'une seule origine : les cookies de session et
// la protection CSRF de Django fonctionnent sans configuration CORS.
const DJANGO = 'http://127.0.0.1:8000'
const proxy = Object.fromEntries(
  ['/api', '/api-auth', '/admin', '/static'].map((chemin) => [
    chemin,
    // changeOrigin: false garde l'en-tête Host du navigateur (localhost:5173) :
    // Django voit alors la même origine que la page et accepte le CSRF.
    { target: DJANGO, changeOrigin: false },
  ]),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
