import { defineConfig, devices } from "@playwright/test"
import * as dotenv from "dotenv"
import * as path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.local so VITE_SUPABASE_* and E2E_* vars are available to
// globalSetup and to test workers (workers inherit process.env).
dotenv.config({ path: path.resolve(__dirname, ".env.local") })

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  // Keep workers at 1: tests hit a real remote Supabase project and must not
  // run in parallel (shared DB state, rate-limits, order-sensitive setup).
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/setup/global-setup.ts",

  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    // Reuse an already-running dev server locally; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
