import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { overviewHandler } from './src/server/middleware.ts';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'oc-api',
      configureServer(server) {
        // Mesmo handler no dev e no preview: o endpoint é servido pelo processo do
        // Vite, que é quem pode executar o CLI.
        server.middlewares.use('/oc-api/overview', overviewHandler);
      },
      configurePreviewServer(server) {
        server.middlewares.use('/oc-api/overview', overviewHandler);
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
