import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const directory = resolve("output/auth-20261117/e2e-data");
process.env.TAROT_E2E_DEMO_DIR = directory;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "auth-demo.spec.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: "output/auth-20261117/test-results",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000", viewport: { width: 1920, height: 1080 },
    serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node scripts/demo.mjs",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { TAROT_DEMO_DATA_DIR: directory, DEEPSEEK_READING_ENABLED: "false", DEEPSEEK_API_KEY: "" },
  },
});
