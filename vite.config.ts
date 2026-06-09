/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

// Vanilla TypeScript + canvas — no framework plugin needed.
// `base: "./"` keeps built asset URLs relative, so the site works whether it's
// served from a domain root (ryanhuang.work) or a subpath.
// Static art/audio live in `public/assets/**` and are served at `/assets/**`,
// so every existing `"assets/..."` path keeps working unchanged. Vite's own
// emitted bundles go to `dist/bundle/` to avoid clashing with that folder.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "bundle",
    sourcemap: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
