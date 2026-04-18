/**
 * Auth smoke tests
 *
 * 1. Admin can log in and reach the dashboard
 * 2. Admin can sign out and is returned to the landing page
 *
 * These are the most fundamental gates: if auth is broken everything else
 * fails, so they run first and are intentionally narrow.
 */
import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers/auth"

test("@smoke admin can log in and reach the dashboard", async ({ page }) => {
  await loginAs(
    page,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!
  )

  await expect(page).toHaveURL(/\/app/)
  // "Your maps" is the dashboard page h1 (dashboard-page.tsx)
  await expect(page.getByRole("heading", { name: "Your maps" })).toBeVisible()
})

test("@smoke admin can sign out and is redirected to the landing page", async ({
  page,
}) => {
  await loginAs(
    page,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!
  )

  await expect(page).toHaveURL(/\/app/)

  // Sign-out button lives in the sidebar (desktop) — app-shell.tsx
  await page.getByRole("button", { name: "Sign out" }).click()

  // handleSignOut calls navigate("/", { replace: true }) on success
  await expect(page).toHaveURL("/", { timeout: 10_000 })
})
