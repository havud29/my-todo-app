import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<you>.github.io/my-todo-app/ on GitHub Pages
export default defineConfig({
  base: '/my-todo-app/',
  plugins: [react()],
})
