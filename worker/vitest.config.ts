import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-08-14",
        compatibilityFlags: ["nodejs_compat"],
      },
    }),
  ],
  test: {
    fileParallelism: false,
    include: ["test/**/*.test.ts"],
    maxWorkers: 1,
  },
});
