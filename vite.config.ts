import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages deploy path for repository: https://andry1395.github.io/grafik_vichoda/
  base: '/grafik_vichoda/',
  plugins: [react()]
});
