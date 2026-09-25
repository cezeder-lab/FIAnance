import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Vite's dev server needs an inline React Refresh preamble, so the strict CSP is only injected at build time.
const productionCsp = (): Plugin => ({
  name: 'fianance-production-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:" />`,
    ),
});

// base './' so the built index.html loads its assets via file:// inside Electron.
export default defineConfig({
  plugins: [react(), productionCsp()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Loaded from local disk by Electron, so bundle size has no network cost.
    chunkSizeWarningLimit: 1500,
  },
});
