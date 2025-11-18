import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    allowedHosts: ["5173.hmlee.me", "app.hmlee.me"],
  },
  build: {
    rollupOptions: {
      output: {
        // JS, CSS, 이미지 등 자산의 폴더 경로 지정
        assetFileNames: "apps/b2b_margin/assets/[name]-[hash][extname]",
        chunkFileNames: "apps/b2b_margin/assets/[name]-[hash].js",
        entryFileNames: "apps/b2b_margin/assets/[name]-[hash].js",
      },
    },
  },
});
