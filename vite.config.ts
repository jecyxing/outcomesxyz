import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 大依赖单独分包，利用浏览器缓存
          recharts: ["recharts"],
          hyperliquid: ["@nktkas/hyperliquid"],
          viem: ["viem"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
