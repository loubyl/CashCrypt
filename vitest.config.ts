import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Component tests wait up to 5000 ms (DASHBOARD_WAIT) for async UI, so they need more than the 5000 ms default.
const UI_TEST_TIMEOUT_MS = 15000;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "tests/ui/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/ui/setup.ts"],
          testTimeout: UI_TEST_TIMEOUT_MS,
        },
      },
    ],
  },
});
