import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    host: process.env.VITE_HOST || true,
    open: true, // open browser
    proxy: {
      "/directus": {
        target: "http://localhost:8055",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/directus/, ""),
      },
      "/cet": {
        target: "http://10.211.24.24:8055",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/cet/, ""),
      },
      "/school": {
        target: "http://10.211.24.25:8055",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/school/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV === "development",
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
