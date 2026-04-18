/**
 * Public pages smoke tests
 *
 * 1. Unknown URL renders the 404 page (does NOT silently redirect)
 * 2. /privacy renders the Privacy Policy page
 * 3. /terms renders the Terms of Service page
 *
 * These are stateless and require no authentication or test-state setup.
 * They validate that Phase 7 public-surface routes are correctly registered
 * and render content without a React error boundary catch.
 */
import { test, expect } from "@playwright/test"

test(
  "@smoke unknown URL shows the 404 page instead of silently redirecting",
  async ({ page }) => {
    await page.goto("/this-route-does-not-exist")

    // Must stay on the requested path — old behaviour was a silent redirect to /
    await expect(page).toHaveURL("/this-route-does-not-exist")
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible()
  }
)

test("@smoke /privacy renders the Privacy Policy", async ({ page }) => {
  await page.goto("/privacy")
  await expect(page).toHaveURL("/privacy")
  await expect(
    page.getByRole("heading", { name: "Privacy Policy" })
  ).toBeVisible()
})

test("@smoke /terms renders the Terms of Service", async ({ page }) => {
  await page.goto("/terms")
  await expect(page).toHaveURL("/terms")
  await expect(
    page.getByRole("heading", { name: "Terms of Service" })
  ).toBeVisible()
})
