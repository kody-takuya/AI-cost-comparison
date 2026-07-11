import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "static-site",
  base: "/AI-cost-comparison/",
  publicDir: fileURLToPath(new URL("public", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  css: {
    postcss: projectRoot,
  },
  build: {
    outDir: "../pages-dist",
    emptyOutDir: true,
  },
});
