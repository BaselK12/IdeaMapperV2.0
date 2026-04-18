/**
 * Route guard smoke tests
 *
 * 1. Unauthenticated visit to /app is blocked and redirected to /auth
 * 2. Unauthenticated deep-link to a protected map is blocked and redirected to /auth
 * 3. After signing in from a deep-link redirect, the user lands at the
 *    originally requested map (not just the generic /app dashboard)
 *
 * Test 3 uses persistTestMapId from globalSetup so it exercises the full
 * ProtectedRoute → /auth?from=... → sign-in → back-to-from cycle against a
 * real map URL.
 */
import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { persistTestMapId } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".test-state.json"), "utf-8")
) as { persistTestMapId: string }

test(
  "@smoke unauthenticated user visiting /app is redirected to /auth",
  async ({ page }) => {
    await page.goto("/app")
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 })
  }
)

test(
  "@smoke unauthenticated user deep-linking to a protected map is redirected to /auth",
  async ({ page }) => {
    await page.goto(`/app/map/${persistTestMapId}`)
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 })
  }
)

test(
  "@smoke after sign-in from a deep-link, user lands at the originally requested map",
  async ({ page }) => {
    // Navigate to protected map while unauthenticated → lands on /auth
    await page.goto(`/app/map/${persistTestMapId}`)
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 })

    // Sign in through the form already on screen (auth-card.tsx IDs)
    await page.fill("#auth-email", process.env.E2E_ADMIN_EMAIL!)
    await page.fill("#auth-password", process.env.E2E_ADMIN_PASSWORD!)
    await page.click('button[type="submit"]')

    // auth-page.tsx reads location.state.from and navigates there post-login
    await expect(page).toHaveURL(
      new RegExp(`/app/map/${persistTestMapId}`),
      { timeout: 15_000 }
    )
  }
)
