import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.js"],
    // Integration specs (src/*.int.test.js) boot the app + hit Postgres.
    hookTimeout: 30000,
    testTimeout: 20000,
    // Unit tests must not need a database or network.
    // Integration tests (added later) will live under tests/integration/
    // and run against a disposable Postgres instance.
  },
});
