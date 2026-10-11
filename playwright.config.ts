import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: { FOLIO_E2E: "true", APP_ORIGIN: "http://127.0.0.1:3100" },
  },
});
