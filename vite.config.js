import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(),tailwindcss()],
  base: './', 
  build: {
    outDir: 'dist', 
    rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/index.js',
          assetFileNames: 'assets/index.css',
        }
      }
  }
  
});
