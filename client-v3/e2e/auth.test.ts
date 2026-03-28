/**
 * TEST 1 — Auth smoke test
 *
 * Verifies that a user with valid credentials can sign in and land on the
 * dashboard.  This is the most fundamental gate: if auth is broken everything
 * else fails, so it runs first and is intentionally narrow.
 */
import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers/auth"

test("admin can log in and reach the dashboard", async ({ page }) => {
  await loginAs(
    page,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!
  )

  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByText("Map Library")).toBeVisible()
})
