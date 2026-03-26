import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Separate build config for the content script.
// Outputs a single self-contained IIFE to dist/content.js.
// emptyOutDir: false so it doesn't wipe the main popup build.
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/content.jsx"),
      name: "SalahSyncContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
