import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// Relative base so the build works on GitHub Pages project sites and Cloudflare Pages alike.
export default defineConfig({
  base: './',
  plugins: [preact()],
})
