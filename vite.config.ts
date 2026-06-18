/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

// https://vitejs.dev/config/
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: "remove-cdn-references",
      enforce: "post",
      transform(code, id) {
        if (
          id.includes("jspdf") &&
          code.includes("cdnjs.cloudflare.com/ajax/libs/pdfobject")
        ) {
          console.log(`[Vite Plugin] Transforming CDN reference in: ${id}`);
          return code.replace(
            /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdfobject\/[0-9.]+\/pdfobject\.min\.js/g,
            "",
          );
        }
      },
      renderChunk(code, chunk) {
        console.log(`[Vite Plugin] Processing chunk: ${chunk.fileName}`);
        if (code.includes("cdnjs.cloudflare.com/ajax/libs/pdfobject")) {
          console.log(
            `[Vite Plugin] Found CDN reference in chunk: ${chunk.fileName}`,
          );
          return code.replace(
            /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdfobject\/[0-9.]+\/pdfobject\.min\.js/g,
            "",
          );
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
