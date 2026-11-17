import { defineConfig } from "@playwright/test";
import { join } from "node:path";

const baseURL = "http://127.0.0.1:3000";
const demoDirectory = join(process.cwd(), "output", "playwright", "demo-data");
process.env.TAROT_E2E_DEMO_DIR = demoDirectory;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: "output/playwright/test-results",
  preserveOutput: "failures-only",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  use: {
    baseURL,
    viewport: { width: 1920, height: 1080 },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node scripts/demo.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DEEPSEEK_READING_ENABLED: "false", DEEPSEEK_API_KEY: "",
      TAROT_DEMO_DATA_DIR: demoDirectory,
    },
  },
});
