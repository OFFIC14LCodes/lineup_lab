import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts")
    }
  },
  test: {
    include: ["scripts/**/*.smoke.ts"],
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    testTimeout: 120000,
    hookTimeout: 120000
  }
});
