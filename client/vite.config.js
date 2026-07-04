import { defineConfig } from 'vite';

// In dev, Vite runs on :5173 and proxies Socket.IO + API to the Express
// server on :3000. In prod, Express serves the built client on one port.
export default defineConfig({
  server: {
    host: true, // bind 0.0.0.0 so other devices on the LAN can reach the dev server
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});