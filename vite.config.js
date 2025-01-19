import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public', // Ensure assets from 'public' are directly copied
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Force icons to stay in the root directory
          if (/icon\d+\.png$/.test(assetInfo.name)) {
            return '[name][extname]';
          }
          return 'assets/[name][extname]'; // Default for other assets
        },
      },
    },
  },
});

