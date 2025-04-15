import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()], 
  base: '/error-visualization/',  // <-- this ensures correct loading of JS/CSS assets
})
