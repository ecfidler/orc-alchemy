// Playwright config for the bookmarklet test against the dockerized old app
// (ORC-67). See docker.e2e.ts for how to run it. The files end in .e2e.ts,
// not .spec.ts, so that `bun test` in this package does not pick them up.
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  timeout: 180_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  // The old app serves a self-signed certificate.
  use: { baseURL: "http://localhost:4173", ignoreHTTPSErrors: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run build && bun run preview --port 4173 --strictPort",
    cwd: join(import.meta.dirname, "../../../packages/app"),
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
