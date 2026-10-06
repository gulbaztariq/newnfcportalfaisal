import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const API = process.env.VITE_API_TARGET || 'http://localhost:5000';
const proxy = { target: API, changeOrigin: false };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { port: 5173, proxy: { '/api': proxy, '/uploads': proxy, '/t/preview': proxy } },
  // static files in public/ are served by the API server; the bundle goes to /build
  build: {
    outDir: 'dist', emptyOutDir: true, assetsDir: 'build', copyPublicDir: false, chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: (id) => (id.includes('recharts') || id.includes('d3-') ? 'charts' : id.includes('@tiptap') || id.includes('prosemirror') ? 'editor' : undefined) } },
  },
});
